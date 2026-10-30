#include "ink_wifi.h"

#include <stdbool.h>
#include <string.h>

#include "esp_check.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "nvs_flash.h"

// The event handler only sets these bits; the public functions block on them.
#define GOT_IP_BIT       BIT0
#define DISCONNECTED_BIT BIT1
#define STOPPED_BIT      BIT2

#define STOP_TIMEOUT_MS 5000

static const char *TAG = "ink_wifi";

static EventGroupHandle_t s_events;
static bool s_initialized;
static bool s_started;

static void event_handler(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        wifi_event_sta_disconnected_t *event = data;
        ESP_LOGW(TAG, "Disconnected, reason %d", event->reason);
        xEventGroupClearBits(s_events, GOT_IP_BIT);
        xEventGroupSetBits(s_events, DISCONNECTED_BIT);
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_STOP) {
        xEventGroupSetBits(s_events, STOPPED_BIT);
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = data;
        ESP_LOGI(TAG, "Got IP " IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(s_events, GOT_IP_BIT);
    }
}

// One-time setup. Failures here mean the system itself is broken, so they abort
// (and reboot) instead of being returned.
static void init_once(void)
{
    if (s_initialized) {
        return;
    }

    esp_err_t err = nvs_flash_init(); // The Wi-Fi driver keeps calibration data in NVS
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    s_events = xEventGroupCreate();
    assert(s_events);

    ESP_ERROR_CHECK(esp_netif_init());
    err = esp_event_loop_create_default();
    if (err != ESP_ERR_INVALID_STATE) { // Already created is fine
        ESP_ERROR_CHECK(err);
    }
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t init_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init_config));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM)); // Credentials are compiled in, no need to write them to flash
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));

    s_initialized = true;
}

// Stops Wi-Fi and waits for the stop event. Events are delivered in order, so once it
// arrives no event from the old connection can still be pending.
static void stop(void)
{
    if (s_started) {
        xEventGroupClearBits(s_events, STOPPED_BIT);
        esp_wifi_stop();
        xEventGroupWaitBits(s_events, STOPPED_BIT, pdFALSE, pdFALSE, pdMS_TO_TICKS(STOP_TIMEOUT_MS));
        s_started = false;
    }
    xEventGroupClearBits(s_events, GOT_IP_BIT | DISCONNECTED_BIT);
}

esp_err_t ink_wifi_connect(const char *ssid, const char *password, uint32_t timeout_ms)
{
    wifi_config_t config = {
        .sta.threshold.authmode = WIFI_AUTH_WPA2_PSK,
    };
    if (ssid == NULL || password == NULL ||
        strlen(ssid) > sizeof(config.sta.ssid) || strlen(password) > sizeof(config.sta.password)) {
        ESP_LOGE(TAG, "Invalid SSID or password");
        return ESP_ERR_INVALID_ARG;
    }
    memcpy(config.sta.ssid, ssid, strlen(ssid));
    memcpy(config.sta.password, password, strlen(password));

    init_once();
    if (xEventGroupGetBits(s_events) & GOT_IP_BIT) {
        return ESP_OK;
    }

    stop(); // Start clean, even if a previous connection dropped
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &config), TAG, "set config");
    ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "start");
    s_started = true;

    ESP_LOGI(TAG, "Connecting to %s...", ssid);
    esp_err_t err = esp_wifi_connect();
    if (err != ESP_OK) {
        stop();
        return err;
    }

    EventBits_t bits = xEventGroupWaitBits(s_events, GOT_IP_BIT | DISCONNECTED_BIT, pdFALSE, pdFALSE,
                                           pdMS_TO_TICKS(timeout_ms));
    if (bits & GOT_IP_BIT) {
        return ESP_OK;
    }
    stop();
    if (bits & DISCONNECTED_BIT) {
        ESP_LOGE(TAG, "Failed to connect to %s", ssid);
        return ESP_FAIL;
    }
    ESP_LOGE(TAG, "Timed out connecting to %s", ssid);
    return ESP_ERR_TIMEOUT;
}

esp_err_t ink_wifi_connect_any(const ink_wifi_network_t *networks, size_t count, uint32_t timeout_ms)
{
    esp_err_t err = ESP_ERR_INVALID_ARG;
    for (size_t i = 0; i < count && err != ESP_OK; i++) {
        err = ink_wifi_connect(networks[i].ssid, networks[i].password, timeout_ms);
    }
    return err;
}

void ink_wifi_disconnect(void)
{
    if (s_initialized) {
        stop();
    }
}
