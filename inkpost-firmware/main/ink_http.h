#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

// Synchronous HTTP(S) client: one call sends the request and returns the whole response.
// https:// URLs are always verified against ESP-IDF's certificate bundle.

typedef struct {
    const char *name;
    const char *value;
} ink_http_header_t;

typedef struct {
    const char *url;                    // https:// or http://
    const ink_http_header_t *headers;   // Optional request headers
    size_t header_count;
    size_t max_body_len;                // 0 = 64 KB
    uint32_t timeout_ms;                // 0 = 10 s
} ink_http_request_t;

typedef struct {
    int status;                         // As sent by the server: 200, 304, 404, ...
    ink_http_header_t *headers;         // Every response header
    size_t header_count;
    char *body;                         // Always NUL-terminated, but may hold binary data
    size_t body_len;                    // Excludes the NUL terminator
} ink_http_response_t;

// Sends a GET and blocks until the whole response is in memory. Redirects are not followed.
// ESP_OK means a complete response was received, whatever its status code.
// On any error, resp is left empty.
//
// Returns:
//   ESP_OK                    complete response in resp
//   ESP_ERR_INVALID_SIZE      body larger than max_body_len
//   ESP_ERR_INVALID_RESPONSE  connection dropped before the whole body arrived
//   ESP_ERR_TIMEOUT           server stopped answering for timeout_ms
//   ESP_ERR_NO_MEM            out of memory
//   ESP_ERR_INVALID_ARG       missing url or resp
//   other                     connection failure (DNS, TCP, TLS) from esp_http_client
esp_err_t ink_http_request(const ink_http_request_t *req, ink_http_response_t *resp);

// Value of a response header (case-insensitive name), or NULL if absent.
const char *ink_http_response_header(const ink_http_response_t *resp, const char *name);

// Frees everything in resp. Always safe to call after ink_http_request, whatever it returned.
void ink_http_response_free(ink_http_response_t *resp);
