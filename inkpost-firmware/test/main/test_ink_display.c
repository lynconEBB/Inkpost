#include <stdio.h>
#include <stdlib.h>

#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "unity.h"

#include "ink_display.h"
#include "ink_http.h"
#include "ink_wifi.h"
#include "secrets.h"

static const ink_wifi_network_t s_networks[] = WIFI_NETWORKS;

// Needs the panel connected. The drawing tests are checked by eye.

// Dev API server on the local network ([api] tests only). The stripes pattern is 8 px vertical
// bands starting black, so every byte is 0x00 or 0xFF.
#define TEST_IMAGE_URL "http://192.168.15.48:8080/api/test-image?pattern=stripes"

// Waveshare recommends at least 180 s between refreshes. This is only tracked within one run,
// so leave 3 minutes between runs yourself.
#define MIN_REFRESH_INTERVAL_S 180

static int64_t s_last_refresh_us = -1; // -1: no refresh yet in this run

// Waits until the previous refresh is old enough, then inits. The wait happens before init,
// so the panel is never powered while waiting.
static void begin_refresh(void)
{
    if (s_last_refresh_us >= 0) {
        int64_t wait_us = s_last_refresh_us + MIN_REFRESH_INTERVAL_S * 1000000LL - esp_timer_get_time();
        if (wait_us > 0) {
            printf("Waiting %d s so refreshes stay %d s apart\n", (int)(wait_us / 1000000), MIN_REFRESH_INTERVAL_S);
            vTaskDelay(pdMS_TO_TICKS(wait_us / 1000));
        }
    }
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_init());
}

// Takes the result of the refresh, then deinits
static void end_refresh(esp_err_t err)
{
    s_last_refresh_us = esp_timer_get_time();
    TEST_ASSERT_EQUAL(ESP_OK, err);
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_deinit());
}

TEST_CASE("draws the checkerboard", "[display]")
{
    begin_refresh();
    end_refresh(ink_display_draw_checker());
}

TEST_CASE("clears the display", "[display]")
{
    begin_refresh();
    end_refresh(ink_display_clear());
}

TEST_CASE("draws the stripes test image from the API", "[display][api]")
{
    // Download first, so the panel isn't powered during the network part
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect_any(s_networks, sizeof(s_networks) / sizeof(s_networks[0]), 30000));
    ink_http_response_t resp;
    TEST_ASSERT_EQUAL(ESP_OK, ink_http_request(&(ink_http_request_t){ .url = TEST_IMAGE_URL }, &resp));
    TEST_ASSERT_EQUAL(200, resp.status);
    TEST_ASSERT_EQUAL(INK_DISPLAY_BUFFER_SIZE, resp.body_len);

    begin_refresh();
    end_refresh(ink_display_draw((const uint8_t *)resp.body, resp.body_len));
    ink_http_response_free(&resp);
}

TEST_CASE("misuse is rejected", "[display]")
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_deinit()); // Not initialized: nothing to do
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_STATE, ink_display_clear());
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_STATE, ink_display_draw_checker());

    uint8_t *image = malloc(INK_DISPLAY_BUFFER_SIZE + 1);
    TEST_ASSERT_NOT_NULL(image);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_STATE, ink_display_draw(image, INK_DISPLAY_BUFFER_SIZE));
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, ink_display_draw(NULL, INK_DISPLAY_BUFFER_SIZE));
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_SIZE, ink_display_draw(image, INK_DISPLAY_BUFFER_SIZE - 1));
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_SIZE, ink_display_draw(image, INK_DISPLAY_BUFFER_SIZE + 1));
    free(image);

    // Init powers the panel up but doesn't refresh it
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_init());
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_STATE, ink_display_init());
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_deinit());
}
