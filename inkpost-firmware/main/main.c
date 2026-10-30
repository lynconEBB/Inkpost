#include <stdbool.h>
#include <string.h>

#include "esp_attr.h"
#include "esp_check.h"
#include "esp_log.h"

#include "ink_api.h"
#include "ink_display.h"
#include "ink_time.h"
#include "ink_wifi.h"
#include "secrets.h"

#define ATTEMPTS          3     // D2: tries per wake before giving up until the next one
#define MAX_WIFI_NETWORKS 3     // D57: each attempt tries them all, so this bounds a wake's Wi-Fi time
#define WIFI_TIMEOUT_MS   30000
#define NTP_TIMEOUT_MS    10000
#define CYCLE_HOURS       3     // D3: wakes on the 00:00, 03:00, ..., 21:00 marks
#define WAKE_MINUTE       1     // D25: just past the mark, so the server's schedule has switched
#define MIN_SLEEP_MINUTES 5     // D3: the next wake is at least this far away
#define FALLBACK_SLEEP_S  (CYCLE_HOURS * 3600) // D24: the clock was never set
#define DAILY_REDRAW_HOUR 0     // D35: the wake at this mark redraws even an unchanged image

static const char *TAG = "inkpost";

// D57: tried in this order until one connects
static const ink_wifi_network_t s_networks[] = WIFI_NETWORKS;
#define WIFI_NETWORK_COUNT (sizeof(s_networks) / sizeof(s_networks[0]))
_Static_assert(WIFI_NETWORK_COUNT >= 1 && WIFI_NETWORK_COUNT <= MAX_WIFI_NETWORKS,
               "WIFI_NETWORKS in secrets.h needs 1 to 3 networks");

// The ETag of the image on the panel, or "" (D9). RTC memory survives deep sleep but not a reset
// or a power-on, so those start without one and draw the next frame (D10, D12).
RTC_DATA_ATTR static char s_etag[INK_API_ETAG_MAX_LEN] = "";

// D35, D46: the wake whose nearest 3-hour mark is 00:00 (local 22:30-01:30), so a slightly early
// wake (23:59:50) counts too. With the clock never set it is a normal wake.
static bool is_daily_redraw_wake(void)
{
    struct tm t;
    if (ink_time_now(&t) != ESP_OK) {
        return false;
    }
    t.tm_min -= CYCLE_HOURS * 60 / 2; // The nearest mark is the next one from half a cycle ago
    ink_time_round_up_to_hours(&t, CYCLE_HOURS);
    return t.tm_hour == DAILY_REDRAW_HOUR;
}

// Downloads the image and draws it if it changed. The panel is only powered while drawing, after
// the whole image is in RAM and checked (D5).
static esp_err_t show_image(bool daily_redraw)
{
    if (daily_redraw) {
        ESP_LOGI(TAG, "Daily redraw: no If-None-Match");
    }
    ink_api_image_t image;
    esp_err_t err = ink_api_get_image(IMAGE_URL, DEVICE_KEY, daily_redraw ? "" : s_etag, &image);
    if (err != ESP_OK) {
        return err; // The panel wasn't touched, so s_etag still describes it
    }
    if (!image.changed) {
        ESP_LOGI(TAG, "Unchanged, panel not refreshed");
        ink_api_image_free(&image);
        return ESP_OK;
    }

    err = ink_display_init();
    if (err == ESP_OK) {
        err = ink_display_draw(image.image, INK_DISPLAY_BUFFER_SIZE);
    }
    ink_display_deinit();
    // After a failed refresh the panel's content is unknown: the next request must get a 200,
    // not a 304 for the frame that was there before (D46)
    strcpy(s_etag, err == ESP_OK ? image.etag : "");
    ink_api_image_free(&image);
    return err;
}

// One attempt at the whole update: Wi-Fi, clock, image, panel
static esp_err_t update(void)
{
    ESP_RETURN_ON_ERROR(ink_wifi_connect_any(s_networks, WIFI_NETWORK_COUNT, WIFI_TIMEOUT_MS), TAG, "Wi-Fi");
    ink_time_sync(NTP_TIMEOUT_MS); // If it fails, the clock kept through deep sleep is used
    return show_image(is_daily_redraw_wake());
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
    // A reset or power-on left the panel powered while the board booted (D33). Deep-sleep wakes
    // keep it off, and their first init always works.
    ink_display_power_off();
    for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
        if (update() == ESP_OK) {
            break;
        }
        ESP_LOGW(TAG, "Attempt %d of %d failed", attempt, ATTEMPTS);
    }
    ink_wifi_disconnect();
    ink_time_deep_sleep(seconds_until_next_wake());
}
