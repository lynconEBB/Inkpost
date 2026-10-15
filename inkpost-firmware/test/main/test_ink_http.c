#include <string.h>

#include "esp_system.h"
#include "unity.h"

#include "ink_http.h"
#include "ink_wifi.h"
#include "secrets.h"

// Needs internet access: httpbin.org echoes requests, badssl.com serves broken certificates.
#define HTTPBIN "https://httpbin.org"

static void connect_wifi(void)
{
    TEST_ASSERT_EQUAL(ESP_OK, ink_wifi_connect(WIFI_SSID, WIFI_PASSWORD, 30000));
}

static esp_err_t get(const char *url, size_t max_body_len, ink_http_response_t *resp)
{
    return ink_http_request(&(ink_http_request_t){ .url = url, .max_body_len = max_body_len }, resp);
}

TEST_CASE("GET returns status and body", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;
    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/get", 0, &resp));
    TEST_ASSERT_EQUAL(200, resp.status);
    TEST_ASSERT_EQUAL(strlen(resp.body), resp.body_len);
    TEST_ASSERT_NOT_NULL(strstr(resp.body, "\"url\""));
    ink_http_response_free(&resp);
}

TEST_CASE("request headers are sent", "[http]")
{
    connect_wifi();
    ink_http_header_t headers[] = { { "X-Inkpost-Test", "hello-inkpost" } };
    ink_http_response_t resp;
    TEST_ASSERT_EQUAL(ESP_OK, ink_http_request(&(ink_http_request_t){
        .url = HTTPBIN "/headers",
        .headers = headers,
        .header_count = 1,
    }, &resp));
    TEST_ASSERT_EQUAL(200, resp.status);
    TEST_ASSERT_NOT_NULL(strstr(resp.body, "hello-inkpost"));
    ink_http_response_free(&resp);
}

TEST_CASE("response headers are captured", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;
    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/response-headers?ETag=abc123", 0, &resp));
    TEST_ASSERT_EQUAL(200, resp.status);
    TEST_ASSERT_EQUAL_STRING("abc123", ink_http_response_header(&resp, "ETag"));
    TEST_ASSERT_EQUAL_STRING("abc123", ink_http_response_header(&resp, "etag"));
    TEST_ASSERT_NULL(ink_http_response_header(&resp, "X-Not-There"));
    ink_http_response_free(&resp);
}

TEST_CASE("non-200 status is passed through", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;
    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/status/404", 0, &resp));
    TEST_ASSERT_EQUAL(404, resp.status);
    ink_http_response_free(&resp);

    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/status/304", 0, &resp));
    TEST_ASSERT_EQUAL(304, resp.status);
    TEST_ASSERT_EQUAL(0, resp.body_len);
    ink_http_response_free(&resp);
}

TEST_CASE("binary body of image size", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;
    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/bytes/48000", 0, &resp));
    TEST_ASSERT_EQUAL(200, resp.status);
    TEST_ASSERT_EQUAL(48000, resp.body_len);
    ink_http_response_free(&resp);
}

TEST_CASE("chunked body", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;
    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/stream-bytes/48000?chunk_size=1024", 0, &resp));
    TEST_ASSERT_EQUAL(200, resp.status);
    TEST_ASSERT_NOT_NULL(ink_http_response_header(&resp, "Transfer-Encoding"));
    TEST_ASSERT_EQUAL(48000, resp.body_len);
    ink_http_response_free(&resp);
}

TEST_CASE("body size limit", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;

    // Exactly at the limit is fine
    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/bytes/1000", 1000, &resp));
    TEST_ASSERT_EQUAL(1000, resp.body_len);
    ink_http_response_free(&resp);
    TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/stream-bytes/1000?chunk_size=250", 1000, &resp));
    TEST_ASSERT_EQUAL(1000, resp.body_len);
    ink_http_response_free(&resp);

    // Over it fails, with or without Content-Length, and leaves the response empty
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_SIZE, get(HTTPBIN "/bytes/1001", 1000, &resp));
    TEST_ASSERT_NULL(resp.body);
    TEST_ASSERT_NULL(resp.headers);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_SIZE, get(HTTPBIN "/stream-bytes/1001?chunk_size=250", 1000, &resp));
    TEST_ASSERT_NULL(resp.body);
    TEST_ASSERT_NULL(resp.headers);
}

TEST_CASE("invalid certificates are rejected", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;
    TEST_ASSERT_NOT_EQUAL(ESP_OK, get("https://expired.badssl.com/", 0, &resp));
    TEST_ASSERT_NOT_EQUAL(ESP_OK, get("https://wrong.host.badssl.com/", 0, &resp));
    TEST_ASSERT_NOT_EQUAL(ESP_OK, get("https://self-signed.badssl.com/", 0, &resp));
    TEST_ASSERT_NULL(resp.body);
}

TEST_CASE("unknown host fails", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;
    TEST_ASSERT_NOT_EQUAL(ESP_OK, get("https://inkpost.invalid/", 0, &resp));
}

TEST_CASE("repeated requests do not leak", "[http]")
{
    connect_wifi();
    ink_http_response_t resp;

    // Warm up: the first requests allocate long-lived things (DNS cache, lwIP and TLS state)
    for (int i = 0; i < 2; i++) {
        TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/bytes/16384", 0, &resp));
        ink_http_response_free(&resp);
    }

    size_t before = esp_get_free_heap_size();
    for (int i = 0; i < 10; i++) {
        TEST_ASSERT_EQUAL(ESP_OK, get(HTTPBIN "/bytes/16384", 0, &resp));
        ink_http_response_free(&resp);
    }
    size_t after = esp_get_free_heap_size();

    // Some slack for buffers that come and go (Wi-Fi buffers, closed sockets waiting in
    // TIME_WAIT); leaking a body or a client would cost far more than this.
    TEST_ASSERT_LESS_OR_EQUAL_INT(8 * 1024, (int)before - (int)after);
}
