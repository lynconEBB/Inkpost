#include "ink_http.h"

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"

#define DEFAULT_MAX_BODY_LEN (64 * 1024)
#define DEFAULT_TIMEOUT_MS   10000
#define INITIAL_BODY_CAPACITY 4096 // When the server doesn't send Content-Length

static const char *TAG = "ink_http";

typedef struct {
    ink_http_response_t *resp;
    bool out_of_memory;
} request_ctx_t;

// esp_http_client only hands out response headers through its event handler.
static esp_err_t on_http_event(esp_http_client_event_t *event)
{
    if (event->event_id != HTTP_EVENT_ON_HEADER) {
        return ESP_OK;
    }
    request_ctx_t *ctx = event->user_data;
    ink_http_response_t *resp = ctx->resp;

    ink_http_header_t *headers = realloc(resp->headers, (resp->header_count + 1) * sizeof(*headers));
    if (headers == NULL) {
        ctx->out_of_memory = true;
        return ESP_OK;
    }
    resp->headers = headers;

    char *name = strdup(event->header_key);
    char *value = strdup(event->header_value);
    if (name == NULL || value == NULL) {
        free(name);
        free(value);
        ctx->out_of_memory = true;
        return ESP_OK;
    }
    headers[resp->header_count++] = (ink_http_header_t){ .name = name, .value = value };
    return ESP_OK;
}

static esp_err_t read_error(int64_t ret)
{
    return ret == -ESP_ERR_HTTP_EAGAIN ? ESP_ERR_TIMEOUT : ESP_ERR_INVALID_RESPONSE;
}

static esp_err_t read_response(esp_http_client_handle_t client, request_ctx_t *ctx, size_t max_body_len)
{
    ink_http_response_t *resp = ctx->resp;

    int64_t content_length = esp_http_client_fetch_headers(client);
    if (content_length < 0) {
        return content_length == -ESP_ERR_HTTP_EAGAIN ? ESP_ERR_TIMEOUT : ESP_FAIL;
    }
    if (ctx->out_of_memory) {
        return ESP_ERR_NO_MEM;
    }
    resp->status = esp_http_client_get_status_code(client);
    if ((uint64_t)content_length > max_body_len) {
        return ESP_ERR_INVALID_SIZE;
    }

    // The buffer may grow to one byte past the limit: that byte tells a body of exactly
    // max_body_len apart from a longer one when there is no Content-Length.
    size_t limit = max_body_len + 1;
    size_t capacity = content_length > 0 ? (size_t)content_length : INITIAL_BODY_CAPACITY;
    if (capacity > limit) {
        capacity = limit;
    }
    resp->body = malloc(capacity + 1); // + NUL terminator
    if (resp->body == NULL) {
        return ESP_ERR_NO_MEM;
    }

    for (;;) {
        if (resp->body_len > max_body_len) {
            return ESP_ERR_INVALID_SIZE;
        }
        if (resp->body_len == capacity) {
            if (esp_http_client_is_complete_data_received(client)) {
                break;
            }
            capacity = capacity * 2 < limit ? capacity * 2 : limit;
            char *body = realloc(resp->body, capacity + 1);
            if (body == NULL) {
                return ESP_ERR_NO_MEM;
            }
            resp->body = body;
        }
        int n = esp_http_client_read(client, resp->body + resp->body_len, capacity - resp->body_len);
        if (n < 0) {
            return read_error(n);
        }
        if (n == 0) {
            break;
        }
        resp->body_len += n;
    }

    // A partial body must never pass as a success (D5).
    if (!esp_http_client_is_complete_data_received(client)) {
        return ESP_ERR_INVALID_RESPONSE;
    }
    resp->body[resp->body_len] = '\0';
    return ESP_OK;
}

esp_err_t ink_http_request(const ink_http_request_t *req, ink_http_response_t *resp)
{
    if (resp == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    memset(resp, 0, sizeof(*resp));
    if (req == NULL || req->url == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    request_ctx_t ctx = { .resp = resp };
    esp_http_client_config_t config = {
        .url = req->url,
        .method = HTTP_METHOD_GET,
        .timeout_ms = req->timeout_ms ? req->timeout_ms : DEFAULT_TIMEOUT_MS,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .disable_auto_redirect = true,
        .event_handler = on_http_event,
        .user_data = &ctx,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to create client for %s", req->url);
        return ESP_FAIL;
    }

    esp_err_t err = ESP_OK;
    for (size_t i = 0; i < req->header_count && err == ESP_OK; i++) {
        err = esp_http_client_set_header(client, req->headers[i].name, req->headers[i].value);
    }
    if (err == ESP_OK) {
        err = esp_http_client_open(client, 0);
    }
    if (err == ESP_OK) {
        err = read_response(client, &ctx, req->max_body_len ? req->max_body_len : DEFAULT_MAX_BODY_LEN);
    }
    esp_http_client_close(client);
    esp_http_client_cleanup(client);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "GET %s failed: %s", req->url, esp_err_to_name(err));
        ink_http_response_free(resp);
    }
    return err;
}

const char *ink_http_response_header(const ink_http_response_t *resp, const char *name)
{
    for (size_t i = 0; i < resp->header_count; i++) {
        if (strcasecmp(resp->headers[i].name, name) == 0) {
            return resp->headers[i].value;
        }
    }
    return NULL;
}

void ink_http_response_free(ink_http_response_t *resp)
{
    if (resp == NULL) {
        return;
    }
    for (size_t i = 0; i < resp->header_count; i++) {
        free((char *)resp->headers[i].name);
        free((char *)resp->headers[i].value);
    }
    free(resp->headers);
    free(resp->body);
    memset(resp, 0, sizeof(*resp));
}
