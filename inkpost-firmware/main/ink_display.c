// Driver for the Waveshare 7.5" e-Paper V2 (UC8179 controller) on the e-Paper Driver HAT Rev2.3.
// The protocol follows Waveshare's EPD_7in5_V2 reference driver.
//
// HAT switches: Display Config = B (0.47R), Interface Config = 0 (4-line SPI).
// Wiring: HAT VCC -> 3V3, GND -> GND, and the pins below.
#include "ink_display.h"

#include <stdbool.h>
#include <string.h>

#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "esp_attr.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define PIN_DIN  19 // SPI MOSI
#define PIN_CLK  18 // SPI SCLK
#define PIN_CS   5  // Strapping pin, fine as long as nothing pulls it low at boot
#define PIN_DC   17 // Low = command, high = data
#define PIN_RST  16
#define PIN_BUSY 35 // Low while the panel works. Input-only pin, no internal pull
#define PIN_PWR  32 // High powers the panel

#define SPI_HOST_ID     SPI2_HOST
#define SPI_CLOCK_HZ    (4 * 1000 * 1000)
#define CHUNK_SIZE      4000 // Bytes per SPI transaction; divides INK_DISPLAY_BUFFER_SIZE
#define BUSY_TIMEOUT_MS 30000
#define BYTES_PER_ROW   (INK_DISPLAY_WIDTH / 8)
#define CHECKER_SQUARE  40 // px; a multiple of 8, so every byte falls in a single square

#define CMD_PANEL_SETTING      0x00
#define CMD_POWER_SETTING      0x01
#define CMD_POWER_OFF          0x02
#define CMD_POWER_ON           0x04
#define CMD_BOOSTER_SOFT_START 0x06
#define CMD_DEEP_SLEEP         0x07
#define CMD_OLD_DATA           0x10
#define CMD_REFRESH            0x12
#define CMD_NEW_DATA           0x13
#define CMD_DUAL_SPI           0x15
#define CMD_VCOM_DATA_INTERVAL 0x50
#define CMD_TCON               0x60
#define CMD_RESOLUTION         0x61
#define CMD_GET_STATUS         0x71

#define RETURN_ON_ERROR(x) do { esp_err_t err_ = (x); if (err_ != ESP_OK) return err_; } while (0)

// Sends a command followed by its parameter bytes
#define COMMAND(cmd, ...) \
    command(cmd, (const uint8_t[]){ __VA_ARGS__ }, sizeof((const uint8_t[]){ __VA_ARGS__ }))

// Returns byte i of the frame being sent
typedef uint8_t (*byte_at_fn)(const void *ctx, size_t i);

static const char *TAG = "ink_display";

static spi_device_handle_t s_spi; // NULL when not initialized
static bool s_bus_initialized;
// The control pins are configured once and stay outputs, driven low while deinitialized.
// Resetting them instead would let PWR float high for a moment.
static bool s_pins_configured;
// Everything sent goes through this buffer, so callers' data can live anywhere (flash, stack)
DMA_ATTR static uint8_t s_chunk[CHUNK_SIZE];

static void delay_ms(uint32_t ms)
{
    vTaskDelay(pdMS_TO_TICKS(ms));
}

static esp_err_t logged(const char *action, esp_err_t err)
{
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "%s failed: %s", action, esp_err_to_name(err));
    }
    return err;
}

// Sends the first len bytes of s_chunk in one CS window, as a command or as data
static esp_err_t send_chunk(bool data, size_t len)
{
    gpio_set_level(PIN_DC, data);
    gpio_set_level(PIN_CS, 0);
    spi_transaction_t transaction = { .length = len * 8, .tx_buffer = s_chunk };
    esp_err_t err = spi_device_polling_transmit(s_spi, &transaction);
    gpio_set_level(PIN_CS, 1);
    return err;
}

static esp_err_t command(uint8_t cmd, const uint8_t *params, size_t len)
{
    s_chunk[0] = cmd;
    RETURN_ON_ERROR(send_chunk(false, 1));
    if (len > 0) {
        memcpy(s_chunk, params, len);
        RETURN_ON_ERROR(send_chunk(true, len));
    }
    return ESP_OK;
}

static bool is_busy(void)
{
    return gpio_get_level(PIN_BUSY) == 0;
}

static esp_err_t wait_idle(void)
{
    int64_t start_us = esp_timer_get_time();
    for (;;) {
        // Some panel revisions only update BUSY after a status request
        RETURN_ON_ERROR(command(CMD_GET_STATUS, NULL, 0));
        if (!is_busy()) {
            delay_ms(20);
            return ESP_OK;
        }
        if (esp_timer_get_time() - start_us > BUSY_TIMEOUT_MS * 1000LL) {
            ESP_LOGE(TAG, "Panel still busy after %d ms: check the wiring and the PWR pin", BUSY_TIMEOUT_MS);
            return ESP_ERR_TIMEOUT;
        }
        delay_ms(10);
    }
}

// Cuts the panel's power, then pulls the other lines low so they don't feed the unpowered panel
static void release(void)
{
    gpio_set_level(PIN_PWR, 0);
    gpio_set_level(PIN_CS, 0);
    gpio_set_level(PIN_DC, 0);
    gpio_set_level(PIN_RST, 0);
    if (s_spi != NULL) {
        spi_bus_remove_device(s_spi);
        s_spi = NULL;
    }
    if (s_bus_initialized) {
        spi_bus_free(SPI_HOST_ID);
        s_bus_initialized = false;
    }
}

static esp_err_t setup_pins_and_spi(void)
{
    if (!s_pins_configured) {
        gpio_config_t outputs = {
            .pin_bit_mask = BIT64(PIN_CS) | BIT64(PIN_DC) | BIT64(PIN_RST) | BIT64(PIN_PWR),
            .mode = GPIO_MODE_OUTPUT,
        };
        RETURN_ON_ERROR(gpio_config(&outputs));
        gpio_config_t busy = {
            .pin_bit_mask = BIT64(PIN_BUSY),
            .mode = GPIO_MODE_INPUT,
        };
        RETURN_ON_ERROR(gpio_config(&busy));
        s_pins_configured = true;
    }
    gpio_set_level(PIN_CS, 1);
    gpio_set_level(PIN_PWR, 1);

    spi_bus_config_t bus = {
        .mosi_io_num = PIN_DIN,
        .miso_io_num = -1,
        .sclk_io_num = PIN_CLK,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = CHUNK_SIZE,
    };
    RETURN_ON_ERROR(spi_bus_initialize(SPI_HOST_ID, &bus, SPI_DMA_CH_AUTO));
    s_bus_initialized = true;

    spi_device_interface_config_t device = {
        .clock_speed_hz = SPI_CLOCK_HZ,
        .mode = 0,
        .spics_io_num = -1, // CS is driven by hand, so a command and its data share one CS window
        .queue_size = 1,
    };
    return spi_bus_add_device(SPI_HOST_ID, &device, &s_spi);
}

static void reset(void)
{
    gpio_set_level(PIN_RST, 1);
    delay_ms(20);
    gpio_set_level(PIN_RST, 0);
    delay_ms(2);
    gpio_set_level(PIN_RST, 1);
    delay_ms(20);
}

static esp_err_t power_up(void)
{
    RETURN_ON_ERROR(setup_pins_and_spi());
    delay_ms(100); // Let the panel's supply settle after PWR goes high
    reset();

    RETURN_ON_ERROR(COMMAND(CMD_POWER_SETTING, 0x07, 0x07, 0x3f, 0x3f)); // VGH=20V, VGL=-20V, VDH=15V, VDL=-15V
    RETURN_ON_ERROR(COMMAND(CMD_BOOSTER_SOFT_START, 0x17, 0x17, 0x28, 0x17));
    RETURN_ON_ERROR(command(CMD_POWER_ON, NULL, 0));
    delay_ms(100);
    RETURN_ON_ERROR(wait_idle());

    RETURN_ON_ERROR(COMMAND(CMD_PANEL_SETTING, 0x1F));               // Black/white, waveform from OTP
    RETURN_ON_ERROR(COMMAND(CMD_RESOLUTION, 0x03, 0x20, 0x01, 0xE0)); // 800 x 480
    RETURN_ON_ERROR(COMMAND(CMD_DUAL_SPI, 0x00));
    RETURN_ON_ERROR(COMMAND(CMD_VCOM_DATA_INTERVAL, 0x10, 0x07));
    RETURN_ON_ERROR(COMMAND(CMD_TCON, 0x22));
    return ESP_OK;
}

static esp_err_t power_down(void)
{
    RETURN_ON_ERROR(COMMAND(CMD_VCOM_DATA_INTERVAL, 0xF7)); // Border floating
    RETURN_ON_ERROR(command(CMD_POWER_OFF, NULL, 0));
    RETURN_ON_ERROR(wait_idle());
    RETURN_ON_ERROR(COMMAND(CMD_DEEP_SLEEP, 0xA5));
    delay_ms(100);
    return ESP_OK;
}

// Sends a whole frame into one of the panel's RAMs, every byte XORed with mask
static esp_err_t send_frame(uint8_t ram, byte_at_fn byte_at, const void *ctx, uint8_t mask)
{
    RETURN_ON_ERROR(command(ram, NULL, 0));
    for (size_t offset = 0; offset < INK_DISPLAY_BUFFER_SIZE; offset += CHUNK_SIZE) {
        for (size_t i = 0; i < CHUNK_SIZE; i++) {
            s_chunk[i] = byte_at(ctx, offset + i) ^ mask;
        }
        RETURN_ON_ERROR(send_chunk(true, CHUNK_SIZE));
    }
    return ESP_OK;
}

// Draws the frame given by byte_at. Like Waveshare's driver, the old-data RAM gets the frame
// as-is and the new-data RAM gets it inverted.
static esp_err_t refresh(byte_at_fn byte_at, const void *ctx)
{
    if (s_spi == NULL) {
        return ESP_ERR_INVALID_STATE;
    }
    RETURN_ON_ERROR(send_frame(CMD_OLD_DATA, byte_at, ctx, 0x00));
    RETURN_ON_ERROR(send_frame(CMD_NEW_DATA, byte_at, ctx, 0xFF));

    RETURN_ON_ERROR(command(CMD_REFRESH, NULL, 0));
    delay_ms(100); // The panel needs at least 200 us before BUSY is valid
    // A refresh takes seconds, so the panel must be busy by now. If it isn't, it never got
    // the command, and reporting success would hide that nothing was drawn.
    RETURN_ON_ERROR(command(CMD_GET_STATUS, NULL, 0));
    if (!is_busy()) {
        ESP_LOGE(TAG, "Panel did not start the refresh: check the wiring");
        return ESP_ERR_INVALID_RESPONSE;
    }
    return wait_idle();
}

static uint8_t image_byte(const void *image, size_t i)
{
    return ((const uint8_t *)image)[i];
}

static uint8_t white_byte(const void *ctx, size_t i)
{
    return 0xFF;
}

static uint8_t checker_byte(const void *ctx, size_t i)
{
    size_t y = i / BYTES_PER_ROW;
    size_t x = i % BYTES_PER_ROW * 8;
    bool black = (y / CHECKER_SQUARE + x / CHECKER_SQUARE) % 2 == 0;
    return black ? 0x00 : 0xFF;
}

esp_err_t ink_display_init(void)
{
    if (s_spi != NULL) {
        return logged("init", ESP_ERR_INVALID_STATE);
    }
    esp_err_t err = power_up();
    if (err != ESP_OK) {
        release();
    }
    return logged("init", err);
}

esp_err_t ink_display_draw(const uint8_t *image, size_t len)
{
    if (image == NULL) {
        return logged("draw", ESP_ERR_INVALID_ARG);
    }
    if (len != INK_DISPLAY_BUFFER_SIZE) {
        ESP_LOGE(TAG, "Image is %zu bytes, expected %d", len, INK_DISPLAY_BUFFER_SIZE);
        return logged("draw", ESP_ERR_INVALID_SIZE);
    }
    return logged("draw", refresh(image_byte, image));
}

esp_err_t ink_display_clear(void)
{
    return logged("clear", refresh(white_byte, NULL));
}

esp_err_t ink_display_draw_checker(void)
{
    return logged("draw checker", refresh(checker_byte, NULL));
}

esp_err_t ink_display_deinit(void)
{
    if (s_spi == NULL) {
        return ESP_OK;
    }
    esp_err_t err = power_down();
    release();
    return logged("deinit", err);
}
