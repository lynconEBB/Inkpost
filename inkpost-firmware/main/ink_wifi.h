#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

// Synchronous Wi-Fi station. ESP-IDF's event-driven Wi-Fi is hidden inside:
// every call blocks until it is done.

typedef struct {
    const char *ssid;
    const char *password;
} ink_wifi_network_t;

// Connects to the network and blocks until an IP is obtained, the connection fails,
// or timeout_ms elapses. Makes a single attempt; retrying is up to the caller.
// The first call also initializes NVS, the network stack and the Wi-Fi driver.
// Returns ESP_OK at once if already connected.
//
// Returns:
//   ESP_OK               connected, IP obtained
//   ESP_FAIL             the connection failed (wrong password, network not found, ...)
//   ESP_ERR_TIMEOUT      no IP within timeout_ms
//   ESP_ERR_INVALID_ARG  ssid longer than 32 bytes or password longer than 64
esp_err_t ink_wifi_connect(const char *ssid, const char *password, uint32_t timeout_ms);

// Tries the networks in order with ink_wifi_connect, each with its own timeout_ms, and stops at
// the first one that connects. A network that fails (even with ESP_ERR_INVALID_ARG) is skipped.
//
// Returns:
//   ESP_OK               connected to one of them
//   ESP_ERR_INVALID_ARG  count is 0
//   otherwise            the last network's error
esp_err_t ink_wifi_connect_any(const ink_wifi_network_t *networks, size_t count, uint32_t timeout_ms);

// Disconnects and stops Wi-Fi. Safe to call when not connected.
void ink_wifi_disconnect(void);
