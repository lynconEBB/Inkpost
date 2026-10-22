#include "ink_api.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_log.h"

#include "ink_display.h"

static const char *TAG = "ink_api";

esp_err_t ink_api_get_image(const char *url, const char *key, const char *etag, ink_api_image_t *out)
{
    memset(out, 0, sizeof(*out));

    // The key only travels in this header, never in the URL or the logs (D9)
    char *authorization = NULL;
    if (asprintf(&authorization, "Bearer %s", key) < 0) {
        return ESP_ERR_NO_MEM;
    }
    bool conditional = etag != NULL && etag[0] != '\0';
    ink_http_header_t headers[] = {
        { "Authorization", authorization },
        { "If-None-Match", etag }, // Only sent when conditional
    };
    esp_err_t err = ink_http_request(&(ink_http_request_t){
        .url = url,
        .headers = headers,
        .header_count = conditional ? 2 : 1,
    }, &out->resp);
    free(authorization);
    if (err != ESP_OK) {
        return err; // Already logged by ink_http
    }

    const char *kind = conditional ? "conditional" : "unconditional";
    int status = out->resp.status;
    if (status == 304) {
        ESP_LOGI(TAG, "304 Not Modified (%s request)", kind);
        return ESP_OK;
    }
    if (status != 200) {
        ESP_LOGE(TAG, "Image request returned %d (%s request)", status, kind);
        ink_api_image_free(out);
        return ESP_ERR_INVALID_RESPONSE;
    }
    // A partial or oversized image must never reach the panel (D5)
    if (out->resp.body_len != INK_DISPLAY_BUFFER_SIZE) {
        ESP_LOGE(TAG, "Image is %u bytes, expected %d", (unsigned)out->resp.body_len, INK_DISPLAY_BUFFER_SIZE);
        ink_api_image_free(out);
        return ESP_ERR_INVALID_RESPONSE;
    }

    // Kept verbatim, quotes and any W/ prefix included (D17). Too long to keep counts as absent:
    // the next request is unconditional, which costs at most one redraw.
    const char *new_etag = ink_http_response_header(&out->resp, "ETag");
    if (new_etag != NULL && strlen(new_etag) >= sizeof(out->etag)) {
        ESP_LOGW(TAG, "ETag of %u chars is too long, ignored", (unsigned)strlen(new_etag));
        new_etag = NULL;
    }
    if (new_etag != NULL) {
        strcpy(out->etag, new_etag);
    }
    out->changed = true;
    out->image = (const uint8_t *)out->resp.body;
    ESP_LOGI(TAG, "200 OK (%s request), ETag %s", kind, new_etag != NULL ? new_etag : "none");
    return ESP_OK;
}

void ink_api_image_free(ink_api_image_t *out)
{
    if (out == NULL) {
        return;
    }
    ink_http_response_free(&out->resp);
    memset(out, 0, sizeof(*out));
}
