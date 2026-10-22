#include <string.h>

#include "esp_system.h"
#include "unity.h"

#include "ink_api.h"
#include "ink_display.h"
#include "ink_wifi.h"
#include "secrets.h"

// [ink_api] tests need internet access: httpbin.org stands in for the API, so they need no server
// state. [ink_api][api] tests need the dev API server on the local network, started with
// INKPOST_DEVICE_KEY=test-device-key and a default rule with exactly one frame.
#define HTTPBIN       "https://httpbin.org"
#define API_IMAGE_URL "http://192.168.15.48:8080/api/image"
#define KEY           "test-device-key" // The API tests' key; httpbin ignores it

static void connect_wifi(void)
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, 30000));
}

static void assert_empty(const ink_api_image_t *image)
{
    TEST_ASSERT_FALSE(image->changed);
    TEST_ASSERT_NULL(image->image);
    TEST_ASSERT_EQUAL_STRING("", image->etag);
    TEST_ASSERT_NULL(image->resp.body);
    TEST_ASSERT_NULL(image->resp.headers);
}

TEST_CASE("a 200 of exactly the image size is a new image", "[ink_api]")
{
    connect_wifi();
    ink_api_image_t image;
    TEST_ASSERT_EQUAL(ESP_OK, ink_api_get_image(HTTPBIN "/bytes/48000", KEY, "", &image));
    TEST_ASSERT_TRUE(image.changed);
    TEST_ASSERT_NOT_NULL(image.image);
    TEST_ASSERT_EQUAL(INK_DISPLAY_BUFFER_SIZE, image.resp.body_len);
    TEST_ASSERT_EQUAL_STRING("", image.etag); // httpbin sends no ETag here
    ink_api_image_free(&image);
}

TEST_CASE("a 200 of any other size fails", "[ink_api]")
{
    connect_wifi();
    ink_api_image_t image;
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(HTTPBIN "/bytes/47999", KEY, "", &image));
    assert_empty(&image);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(HTTPBIN "/bytes/48001", KEY, "", &image));
    assert_empty(&image);
    ink_api_image_free(&image); // Safe after an error too
}

TEST_CASE("a matching ETag gets a 304", "[ink_api]")
{
    connect_wifi();
    ink_api_image_t image;

    // Sent verbatim, quotes included. httpbin answers 304 when If-None-Match holds its ETag.
    TEST_ASSERT_EQUAL(ESP_OK, ink_api_get_image(HTTPBIN "/etag/abc", KEY, "\"abc\"", &image));
    TEST_ASSERT_EQUAL(304, image.resp.status);
    TEST_ASSERT_FALSE(image.changed);
    TEST_ASSERT_NULL(image.image);
    TEST_ASSERT_EQUAL_STRING("", image.etag);
    ink_api_image_free(&image);

    // With no ETag no If-None-Match is sent, and httpbin answers 200 with JSON, which isn't an image
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(HTTPBIN "/etag/abc", KEY, "", &image));
    assert_empty(&image);
}

TEST_CASE("other statuses fail", "[ink_api]")
{
    connect_wifi();
    ink_api_image_t image;
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(HTTPBIN "/status/401", KEY, "", &image));
    assert_empty(&image);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(HTTPBIN "/status/404", KEY, "", &image));
    assert_empty(&image);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(HTTPBIN "/status/500", KEY, "", &image));
    assert_empty(&image);
}

TEST_CASE("repeated calls do not leak", "[ink_api]")
{
    connect_wifi();
    ink_api_image_t image;

    // Warm up: the first requests allocate long-lived things (DNS cache, lwIP and TLS state)
    for (int i = 0; i < 2; i++) {
        TEST_ASSERT_EQUAL(ESP_OK, ink_api_get_image(HTTPBIN "/bytes/48000", KEY, "", &image));
        ink_api_image_free(&image);
    }

    // A new image, an unchanged one and a failure each time
    size_t before = esp_get_free_heap_size();
    for (int i = 0; i < 10; i++) {
        TEST_ASSERT_EQUAL(ESP_OK, ink_api_get_image(HTTPBIN "/bytes/48000", KEY, "", &image));
        ink_api_image_free(&image);
        TEST_ASSERT_EQUAL(ESP_OK, ink_api_get_image(HTTPBIN "/etag/abc", KEY, "\"abc\"", &image));
        ink_api_image_free(&image);
        TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(HTTPBIN "/status/404", KEY, "", &image));
    }
    size_t after = esp_get_free_heap_size();

    // The same slack as the ink_http test; leaking an image would cost far more than this
    TEST_ASSERT_LESS_OR_EQUAL_INT(8 * 1024, (int)before - (int)after);
}

TEST_CASE("the dev API sends the image and its ETag, then 304 for it", "[ink_api][api]")
{
    connect_wifi();
    ink_api_image_t image;
    TEST_ASSERT_EQUAL(ESP_OK, ink_api_get_image(API_IMAGE_URL, KEY, "", &image));
    TEST_ASSERT_TRUE(image.changed);
    TEST_ASSERT_EQUAL(INK_DISPLAY_BUFFER_SIZE, image.resp.body_len);
    // The hex SHA-256 of the image, quoted (D17)
    TEST_ASSERT_EQUAL(66, strlen(image.etag));
    TEST_ASSERT_EQUAL('"', image.etag[0]);
    TEST_ASSERT_EQUAL('"', image.etag[65]);

    // The next frame of a one-frame rule is the same image
    char etag[INK_API_ETAG_MAX_LEN];
    strcpy(etag, image.etag);
    ink_api_image_free(&image);
    TEST_ASSERT_EQUAL(ESP_OK, ink_api_get_image(API_IMAGE_URL, KEY, etag, &image));
    TEST_ASSERT_EQUAL(304, image.resp.status);
    TEST_ASSERT_FALSE(image.changed);
    TEST_ASSERT_NULL(image.image);
    ink_api_image_free(&image);
}

TEST_CASE("the dev API rejects a wrong key", "[ink_api][api]")
{
    connect_wifi();
    ink_api_image_t image;
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_RESPONSE, ink_api_get_image(API_IMAGE_URL, "wrong-key", "", &image));
    assert_empty(&image);
}
