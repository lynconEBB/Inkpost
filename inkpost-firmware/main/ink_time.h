#pragma once

#include <stdint.h>
#include <time.h>

#include "esp_err.h"

// Clock, NTP and deep sleep. Local times are in the frame's time zone (Brasília).

// Syncs the clock over NTP and blocks until done or timeout_ms. Needs Wi-Fi.
//
// Returns:
//   ESP_OK           clock synced
//   ESP_ERR_TIMEOUT  no answer within timeout_ms
//   other            SNTP setup error
esp_err_t ink_time_sync(uint32_t timeout_ms);

// Current local time. The clock survives deep sleep, so one successful sync keeps it valid
// until the next power-on.
//
// Returns:
//   ESP_OK                 now holds the local time
//   ESP_ERR_INVALID_STATE  the clock was never set since power-on
esp_err_t ink_time_now(struct tm *now);

// Rounds t up to the next mark every `hours` hours of the day (00:00, 03:00, ... for 3).
// A time exactly on a mark stays. t is normalized first, so out-of-range fields such as
// minute 62 are fine, and the result may move to the next day.
void ink_time_round_up_to_hours(struct tm *t, int hours);

// Seconds from now until the local time `when` (out-of-range fields such as hour 25 are fine).
// 0 if it is in the past or the clock was never set.
uint32_t ink_time_seconds_until(const struct tm *when);

// Deep-sleeps for `seconds`. Never returns: on wake the board boots again and app_main starts
// over. Stop Wi-Fi first.
void ink_time_deep_sleep(uint32_t seconds) __attribute__((noreturn));
