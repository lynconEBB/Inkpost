#include "esp_timer.h"
#include "unity.h"

#include "ink_wifi.h"
#include "secrets.h"

#define TIMEOUT_MS 30000

TEST_CASE("unknown network fails", "[wifi]")
{
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_FAIL, ink_wifi_connect("inkpost-no-such-network", "some-password", TIMEOUT_MS));
}

TEST_CASE("wrong password fails", "[wifi]")
{
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_FAIL, ink_wifi_connect(WIFI_SSID, "inkpost-wrong-password", TIMEOUT_MS));
}

TEST_CASE("too long credentials are rejected", "[wifi]")
{
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG,
                      ink_wifi_connect("an-ssid-longer-than-thirty-two-bytes", "password", TIMEOUT_MS));
}

TEST_CASE("correct credentials connect", "[wifi]")
{
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, TIMEOUT_MS));

    // Already connected: returns at once
    int64_t start_us = esp_timer_get_time();
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, TIMEOUT_MS));
    TEST_ASSERT_LESS_THAN(100, (int)((esp_timer_get_time() - start_us) / 1000));
}

TEST_CASE("reconnects after disconnect", "[wifi]")
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, TIMEOUT_MS));
    ink_wifi_disconnect();
    ink_wifi_disconnect(); // Safe when not connected
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, TIMEOUT_MS));
}
