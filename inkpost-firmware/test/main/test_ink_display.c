#include <stdio.h>
#include <stdlib.h>

#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "unity.h"

#include "ink_display.h"

// Needs the panel connected. The drawing tests are checked by eye.

// Waveshare recommends at least 180 s between refreshes. This is only tracked within one run,
// so leave 3 minutes between runs yourself.
#define MIN_REFRESH_INTERVAL_S 180

static int64_t s_last_refresh_us = -1; // -1: no refresh yet in this run

// Inits, runs one refresh and deinits. The wait for the interval happens before init, so the
// panel is never powered while waiting.
static void refresh_once(esp_err_t (*refresh)(void))
{
    if (s_last_refresh_us >= 0) {
        int64_t wait_us = s_last_refresh_us + MIN_REFRESH_INTERVAL_S * 1000000LL - esp_timer_get_time();
        if (wait_us > 0) {
            printf("Waiting %d s so refreshes stay %d s apart\n", (int)(wait_us / 1000000), MIN_REFRESH_INTERVAL_S);
            vTaskDelay(pdMS_TO_TICKS(wait_us / 1000));
        }
    }

    TEST_ASSERT_EQUAL(ESP_OK, ink_display_init());
    esp_err_t err = refresh();
    s_last_refresh_us = esp_timer_get_time();
    TEST_ASSERT_EQUAL(ESP_OK, err);
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_deinit());
}

TEST_CASE("draws the checkerboard", "[display]")
{
    refresh_once(ink_display_draw_checker);
}

TEST_CASE("clears the display", "[display]")
{
    refresh_once(ink_display_clear);
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
