#include "ink_time.h"

#include <inttypes.h>
#include <stdbool.h>
#include <stdlib.h>

#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "esp_sleep.h"
#include "freertos/FreeRTOS.h"

#define TIMEZONE   "<-03>3" // Brasília: UTC-3, no daylight saving time (POSIX TZ format)
#define NTP_SERVER "pool.ntp.org"
#define CLOCK_SET_AFTER 1735689600 // 2025-01-01: until the first sync the clock starts in 1970

static const char *TAG = "ink_time";

static void apply_timezone(void)
{
    setenv("TZ", TIMEZONE, 1);
    tzset();
}

static bool clock_is_set(time_t t)
{
    return t >= CLOCK_SET_AFTER;
}

esp_err_t ink_time_sync(uint32_t timeout_ms)
{
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG(NTP_SERVER);
    esp_err_t err = esp_netif_sntp_init(&config);
    if (err == ESP_OK) {
        err = esp_netif_sntp_sync_wait(pdMS_TO_TICKS(timeout_ms));
        esp_netif_sntp_deinit();
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NTP sync failed: %s", esp_err_to_name(err));
        return err;
    }

    struct tm now;
    ink_time_now(&now);
    ESP_LOGI(TAG, "Clock synced: %04d-%02d-%02d %02d:%02d:%02d", now.tm_year + 1900, now.tm_mon + 1,
             now.tm_mday, now.tm_hour, now.tm_min, now.tm_sec);
    return ESP_OK;
}

esp_err_t ink_time_now(struct tm *now)
{
    time_t t = time(NULL);
    if (!clock_is_set(t)) {
        return ESP_ERR_INVALID_STATE;
    }
    apply_timezone();
    localtime_r(&t, now);
    return ESP_OK;
}

void ink_time_round_up_to_hours(struct tm *t, int hours)
{
    apply_timezone();
    t->tm_isdst = -1;
    mktime(t); // Normalize first, so e.g. minute 62 carries into the hour

    bool on_mark = t->tm_hour % hours == 0 && t->tm_min == 0 && t->tm_sec == 0;
    if (!on_mark) {
        t->tm_hour = (t->tm_hour / hours + 1) * hours;
        t->tm_min = 0;
        t->tm_sec = 0;
        t->tm_isdst = -1;
        mktime(t); // Hour 24 carries into the next day
    }
}

uint32_t ink_time_seconds_until(const struct tm *when)
{
    time_t now = time(NULL);
    if (!clock_is_set(now)) {
        return 0;
    }
    apply_timezone();
    struct tm target = *when;
    target.tm_isdst = -1;
    time_t target_time = mktime(&target);
    return target_time > now ? (uint32_t)(target_time - now) : 0;
}

void ink_time_deep_sleep(uint32_t seconds)
{
    ESP_LOGI(TAG, "Deep sleep for %" PRIu32 " s", seconds);
    esp_sleep_enable_timer_wakeup((uint64_t)seconds * 1000000);
    esp_deep_sleep_start();
}
