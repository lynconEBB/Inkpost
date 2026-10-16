idf_component_register(
    SRCS "main.c" "ink_wifi.c" "ink_http.c" "ink_display.c" "ink_time.c"
    INCLUDE_DIRS "."
    REQUIRES esp_wifi esp_netif esp_event nvs_flash esp_http_client mbedtls esp_driver_spi esp_driver_gpio esp_timer
)
