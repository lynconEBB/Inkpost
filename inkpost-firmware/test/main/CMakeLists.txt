# Builds the firmware modules straight from ../../main, so the tests run the same code as the firmware.
idf_component_register(
    SRCS "test_main.c" "test_ink_wifi.c" "test_ink_http.c"
         "../../main/ink_wifi.c" "../../main/ink_http.c"
    INCLUDE_DIRS "." "../../main"
    REQUIRES unity esp_wifi esp_netif esp_event nvs_flash esp_http_client mbedtls esp_timer
    WHOLE_ARCHIVE
)
