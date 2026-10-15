#include "esp_log.h"

#include "ink_http.h"
#include "ink_wifi.h"
#include "secrets.h"

#define WIFI_TIMEOUT_MS 30000

static const char *TAG = "inkpost";

void app_main(void)
{
    esp_err_t err = ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, WIFI_TIMEOUT_MS);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Wi-Fi failed: %s", esp_err_to_name(err));
        return;
    }

    ink_http_response_t resp;
    err = ink_http_request(&(ink_http_request_t){ .url = "https://httpbin.org/get" }, &resp);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "status=%d, body=%zu bytes:\n%s", resp.status, resp.body_len, resp.body);
    }
    ink_http_response_free(&resp);
}
