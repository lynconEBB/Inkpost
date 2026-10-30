#include "esp_timer.h"
#include "unity.h"

#include "ink_wifi.h"
#include "secrets.h"

#define TIMEOUT_MS 30000

// The first network must be in range
static const ink_wifi_network_t s_networks[] = WIFI_NETWORKS;
#define SSID     (s_networks[0].ssid)
#define PASSWORD (s_networks[0].password)

TEST_CASE("unknown network fails", "[wifi]")
{
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_FAIL, ink_wifi_connect("inkpost-no-such-network", "some-password", TIMEOUT_MS));
}

TEST_CASE("wrong password fails", "[wifi]")
{
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_FAIL, ink_wifi_connect(SSID, "inkpost-wrong-password", TIMEOUT_MS));
}

TEST_CASE("too long credentials are rejected", "[wifi]")
{
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG,
                      ink_wifi_connect("an-ssid-longer-than-thirty-two-bytes", "password", TIMEOUT_MS));
}

TEST_CASE("correct credentials connect", "[wifi]")
{
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(SSID, PASSWORD, TIMEOUT_MS));

    // Already connected: returns at once
    int64_t start_us = esp_timer_get_time();
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(SSID, PASSWORD, TIMEOUT_MS));
    TEST_ASSERT_LESS_THAN(100, (int)((esp_timer_get_time() - start_us) / 1000));
}

TEST_CASE("reconnects after disconnect", "[wifi]")
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(SSID, PASSWORD, TIMEOUT_MS));
    ink_wifi_disconnect();
    ink_wifi_disconnect(); // Safe when not connected
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(SSID, PASSWORD, TIMEOUT_MS));
}

TEST_CASE("a list connects to the first network that works", "[wifi]")
{
    ink_wifi_network_t networks[] = {
        {"an-ssid-longer-than-thirty-two-bytes", "password"},
        {"inkpost-no-such-network", "some-password"},
        {SSID, "inkpost-wrong-password"},
        {SSID, PASSWORD},
    };
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect_any(networks, 4, TIMEOUT_MS));
}

TEST_CASE("a list with no network that works fails", "[wifi]")
{
    ink_wifi_network_t networks[] = {
        {"inkpost-no-such-network", "some-password"},
        {SSID, "inkpost-wrong-password"},
    };
    ink_wifi_disconnect();
    TEST_ASSERT_EQUAL(ESP_FAIL, ink_wifi_connect_any(networks, 2, TIMEOUT_MS));
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, ink_wifi_connect_any(networks, 0, TIMEOUT_MS));
}
