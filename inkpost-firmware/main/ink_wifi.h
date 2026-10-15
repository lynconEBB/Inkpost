#pragma once

#include <stdint.h>

#include "esp_err.h"

// Synchronous Wi-Fi station. ESP-IDF's event-driven Wi-Fi is hidden inside:
// every call blocks until it is done.

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

// Disconnects and stops Wi-Fi. Safe to call when not connected.
void ink_wifi_disconnect(void);
