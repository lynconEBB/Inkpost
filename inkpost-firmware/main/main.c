#include "esp_bit_defs.h"
#include "esp_event_base.h"
#include "esp_log.h"
#include "esp_err.h"

#include "esp_netif_ip_addr.h"
#include "esp_netif_types.h"
#include "esp_wifi_default.h"
#include "esp_wifi_types_generic.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#include "freertos/projdefs.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "esp_wifi.h"
#include <stdint.h>

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1
#define WIFI_TIMEOUT_MS 30000

static const char* TAG = "Wifi";

static EventGroupHandle_t wifi_event_group;

static void event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) 
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        xEventGroupSetBits(wifi_event_group, WIFI_FAIL_BIT);
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*)event_data;
        ESP_LOGI(TAG, "Got ip: " IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

void app_main(void)
{
    esp_err_t ret = nvs_flash_init(); // Non Volatile storage initialization
    ESP_ERROR_CHECK(ret);

    wifi_event_group = xEventGroupCreate();

    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t wifi_init_config = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&wifi_init_config);

    esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &event_handler, NULL, NULL);
    esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &event_handler, NULL, NULL);

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = "BAEZ",
            .password = "Carpas0659",
            .threshold.authmode =  WIFI_AUTH_WPA2_PSK
        }
    };
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
    esp_wifi_start();

    ESP_LOGI(TAG, "Connecting to %s...", wifi_config.sta.ssid);

    EventBits_t bits = xEventGroupWaitBits(wifi_event_group, WIFI_CONNECTED_BIT | WIFI_FAIL_BIT, pdFALSE, pdFALSE, pdMS_TO_TICKS(WIFI_TIMEOUT_MS));
    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "Connectado com sucesso!");
        esp_http_client_config_t config = {
            .url = "https://httpbin.org/get",
            .timeout_ms = 10000,
            .crt_bundle_attach = esp_crt_bundle_attach
        };
        esp_http_client_handle_t client = esp_http_client_init(&config);
        if (client == NULL) {
            ESP_LOGE(TAG, "Failed to create HTTP client!");
            return;
        }

        esp_err_t ret = esp_http_client_open(client, 0);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to open connection: %s", esp_err_to_name(ret));
            esp_http_client_cleanup(client);
            return;
        }
    
        int64_t content_length = esp_http_client_fetch_headers(client);
        int32_t status = esp_http_client_get_status_code(client)    ;
        ESP_LOGI(TAG, "Status: %d, Content-Length: %lld", status, (long long) content_length);

        static char buf[1024];
        int total = 0;

        while(total < sizeof(buf) - 1) {
            int32_t n = esp_http_client_read(client, buf + total, sizeof(buf) - 1 - total);
            if (n < 0) {
                ESP_LOGE(TAG, "Error reading body");
                break;
            }
            if (n == 0) {
                break;
            }
            total += n;
        }
        buf[total] = '\0';
        ESP_LOGI(TAG, "Body (%d bytes): \n%s", total, buf);

        esp_http_client_close(client);
        esp_http_client_cleanup(client);
    }
    else if (bits & WIFI_FAIL_BIT) 
        ESP_LOGI(TAG, "Failed to connect");
    else 
        ESP_LOGI(TAG, "Timed Out!");


}
