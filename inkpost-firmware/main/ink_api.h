#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

#include "ink_http.h"

// The frame's endpoint, GET /api/image (D9, D46): the device key, the ETag and the checks on the
// image. Stateless: the caller keeps the ETag between wakes.

#define INK_API_ETAG_MAX_LEN 80 // With the NUL. The API sends 66 chars ("<64 hex>"), 68 with a W/ prefix

typedef struct {
    bool changed;                    // false: 304, the frame already shows this image
    const uint8_t *image;            // INK_DISPLAY_BUFFER_SIZE bytes when changed, else NULL
    char etag[INK_API_ETAG_MAX_LEN]; // The new ETag when changed; "" if absent or too long
    ink_http_response_t resp;        // Owns the image
} ink_api_image_t;

// GETs url with `Authorization: Bearer <key>` and, if etag is non-empty, `If-None-Match: <etag>`.
// The ETag is sent back verbatim, quotes and any W/ prefix included. The key is never logged.
// On any error, out is left empty.
//
// Returns:
//   ESP_OK                    200 with exactly INK_DISPLAY_BUFFER_SIZE bytes, or 304
//   ESP_ERR_INVALID_RESPONSE  any other status (401, 404, 5xx), logged with the status;
//                             or a 200 whose body isn't exactly INK_DISPLAY_BUFFER_SIZE bytes (D5)
//   ESP_ERR_NO_MEM            out of memory
//   other                     from ink_http_request (connection, TLS, timeout)
esp_err_t ink_api_get_image(const char *url, const char *key, const char *etag, ink_api_image_t *out);

// Frees everything in out. Always safe to call after ink_api_get_image, whatever it returned.
void ink_api_image_free(ink_api_image_t *out);
