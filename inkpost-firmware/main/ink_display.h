#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

// Waveshare 7.5" e-Paper V2 (800x480, black/white). Every call blocks until the panel is done.

#define INK_DISPLAY_WIDTH  800
#define INK_DISPLAY_HEIGHT 480
#define INK_DISPLAY_BUFFER_SIZE (INK_DISPLAY_WIDTH / 8 * INK_DISPLAY_HEIGHT) // 48000 bytes

// Image format: 1 bit per pixel, bit 1 = white, 0 = black. Rows top to bottom, 100 bytes each;
// the most significant bit of each byte is the leftmost pixel.

// Sets up SPI and GPIO, powers the panel, resets it and turns on its drivers.
// On error everything is released again, so init can simply be retried.
//
// Returns:
//   ESP_OK                 ready to draw
//   ESP_ERR_INVALID_STATE  already initialized
//   ESP_ERR_TIMEOUT        the panel never became ready (wiring, power)
//   other                  SPI or GPIO driver error
esp_err_t ink_display_init(void);

// Full refresh with this image. Takes about 4 s.
// After an error, call ink_display_deinit() so the panel is not left powered.
//
// Returns:
//   ESP_OK                    image drawn
//   ESP_ERR_INVALID_ARG       image is NULL
//   ESP_ERR_INVALID_SIZE      len is not INK_DISPLAY_BUFFER_SIZE
//   ESP_ERR_INVALID_STATE     not initialized
//   ESP_ERR_TIMEOUT           the panel never finished (wiring, power)
//   ESP_ERR_INVALID_RESPONSE  the panel did not start the refresh (wiring)
//   other                     SPI driver error
esp_err_t ink_display_draw(const uint8_t *image, size_t len);

// Full refresh to all white. Same errors as ink_display_draw, minus the image ones.
esp_err_t ink_display_clear(void);

// Full refresh with a checkerboard of 40x40 px squares (20 x 12), the top-left one black.
// For testing the panel and its wiring. Same errors as ink_display_clear.
esp_err_t ink_display_draw_checker(void);

// Puts the panel in deep sleep, cuts its power and releases SPI and GPIO. Everything is
// released even if the sleep commands fail; that error is still returned.
// Safe to call when not initialized.
esp_err_t ink_display_deinit(void);
