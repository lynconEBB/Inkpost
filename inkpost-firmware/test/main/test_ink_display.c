#include <stdlib.h>

#include "unity.h"

#include "ink_display.h"

// Needs the panel connected. The drawing tests are checked by eye.

TEST_CASE("draws the checkerboard", "[display]")
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_init());
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_draw_checker());
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_deinit());
}

TEST_CASE("clears the display", "[display]")
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_init());
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_STATE, ink_display_init());
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_clear());
    TEST_ASSERT_EQUAL(ESP_OK, ink_display_deinit());
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
}
