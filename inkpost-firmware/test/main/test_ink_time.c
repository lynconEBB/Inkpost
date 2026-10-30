#include <time.h>

#include "unity.h"

#include "ink_time.h"
#include "ink_wifi.h"
#include "secrets.h"

static const ink_wifi_network_t s_networks[] = WIFI_NETWORKS;

static void sync_clock(void)
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect_any(s_networks, sizeof(s_networks) / sizeof(s_networks[0]), 30000));
    TEST_ASSERT_EQUAL(ESP_OK, ink_time_sync(10000));
}

// Rounds a local date and time up to a 3-hour mark and checks the result
static void check_round_up(int year, int month, int day, int hour, int minute, int second,
                           int expected_year, int expected_month, int expected_day, int expected_hour)
{
    struct tm t = {
        .tm_year = year - 1900, .tm_mon = month - 1, .tm_mday = day,
        .tm_hour = hour, .tm_min = minute, .tm_sec = second,
    };
    ink_time_round_up_to_hours(&t, 3);
    TEST_ASSERT_EQUAL(expected_year, t.tm_year + 1900);
    TEST_ASSERT_EQUAL(expected_month, t.tm_mon + 1);
    TEST_ASSERT_EQUAL(expected_day, t.tm_mday);
    TEST_ASSERT_EQUAL(expected_hour, t.tm_hour);
    TEST_ASSERT_EQUAL(0, t.tm_min);
    TEST_ASSERT_EQUAL(0, t.tm_sec);
}

TEST_CASE("rounds up to 3-hour marks", "[time]")
{
    check_round_up(2026, 10, 15, 14, 30, 0, 2026, 10, 15, 15);
    check_round_up(2026, 10, 15, 13, 5, 0, 2026, 10, 15, 15);
    check_round_up(2026, 10, 15, 15, 0, 0, 2026, 10, 15, 15);  // On a mark: stays
    check_round_up(2026, 10, 15, 15, 0, 1, 2026, 10, 15, 18);
    check_round_up(2026, 10, 15, 21, 56, 0, 2026, 10, 16, 0);  // Into the next day
    check_round_up(2026, 10, 15, 20, 62, 0, 2026, 10, 16, 0);  // 20:57 + 5 min, as main.c does
    check_round_up(2026, 12, 31, 22, 10, 0, 2027, 1, 1, 0);    // Into the next year
}

TEST_CASE("sync sets the clock", "[time]")
{
    sync_clock();
    struct tm now;
    TEST_ASSERT_EQUAL(ESP_OK, ink_time_now(&now));
    TEST_ASSERT_GREATER_OR_EQUAL(2025, now.tm_year + 1900);
}

TEST_CASE("seconds until a time", "[time]")
{
    sync_clock();
    struct tm when;
    TEST_ASSERT_EQUAL(ESP_OK, ink_time_now(&when));
    when.tm_sec += 90;
    TEST_ASSERT_UINT32_WITHIN(1, 90, ink_time_seconds_until(&when));
    when.tm_sec -= 200; // 110 s ago
    TEST_ASSERT_EQUAL(0, ink_time_seconds_until(&when));
}

// ink_time_deep_sleep has no test here: Unity's run-all would stop at a multi-stage test's
// prompt. The firmware's own wake cycle exercises it.
