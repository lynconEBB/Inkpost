#include "esp_check.h"
#include "esp_log.h"

#include "ink_display.h"
#include "ink_http.h"
#include "ink_time.h"
#include "ink_wifi.h"
#include "secrets.h"

#define ATTEMPTS          3     // D2: tries per wake before giving up until the next one
#define WIFI_TIMEOUT_MS   30000
#define NTP_TIMEOUT_MS    10000
#define CYCLE_HOURS       3     // D3: wakes on the 00:00, 03:00, ..., 21:00 marks
#define WAKE_MINUTE       1     // D25: just past the mark, so the server's schedule has switched
#define MIN_SLEEP_MINUTES 5     // D3: the next wake is at least this far away
#define FALLBACK_SLEEP_S  (CYCLE_HOURS * 3600) // D24: the clock was never set

static const char *TAG = "inkpost";

// Downloads the image and draws it. The panel is only powered while drawing.
static esp_err_t show_image(void)
{
    ink_http_response_t resp;
    esp_err_t err = ink_http_request(&(ink_http_request_t){ .url = IMAGE_URL }, &resp);
    if (err == ESP_OK && resp.status != 200) {
        ESP_LOGE(TAG, "Image request returned %d", resp.status);
        err = ESP_ERR_INVALID_RESPONSE;
    }
    if (err == ESP_OK) {
        err = ink_display_init();
        if (err == ESP_OK) {
            err = ink_display_draw((const uint8_t *)resp.body, resp.body_len);
        }
        ink_display_deinit();
    }
    ink_http_response_free(&resp);
    return err;
}

// One attempt at the whole update: Wi-Fi, clock, image, panel
static esp_err_t update(void)
{
    ESP_RETURN_ON_ERROR(ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, WIFI_TIMEOUT_MS), TAG, "Wi-Fi");
    ink_time_sync(NTP_TIMEOUT_MS); // If it fails, the clock kept through deep sleep is used
    return show_image();
}

// 1 minute past the next 3-hour mark that is at least 5 minutes away:
// 14:30 -> 15:01, 14:57 -> 18:01, a wake at 18:01 -> 21:01
static uint32_t seconds_until_next_wake(void)
{
    struct tm wake;
    if (ink_time_now(&wake) != ESP_OK) {
        ESP_LOGW(TAG, "Clock never set, next wake in %d h", CYCLE_HOURS);
        return FALLBACK_SLEEP_S;
    }
    wake.tm_min += MIN_SLEEP_MINUTES;
    ink_time_round_up_to_hours(&wake, CYCLE_HOURS);
    wake.tm_min = WAKE_MINUTE;
    ESP_LOGI(TAG, "Next wake at %02d:%02d", wake.tm_hour, wake.tm_min);
    return ink_time_seconds_until(&wake);
}

void app_main(void)
{
    for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
        if (update() == ESP_OK) {
            break;
        }
        ESP_LOGW(TAG, "Attempt %d of %d failed", attempt, ATTEMPTS);
    }
    ink_wifi_disconnect();
    ink_time_deep_sleep(seconds_until_next_wake());
}
