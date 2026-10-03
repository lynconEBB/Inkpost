# Design decisions

Running log of how inkpost works and why. Each entry: what we chose, and the reason.

## Firmware

### D1. Firmware does one thing: connect, fetch, display, sleep
Every wake cycle connects to Wi-Fi, requests the image from the API, displays it, and sleeps.
Each cycle is self-contained: no state is required from a previous cycle to succeed.
**Why:** it's a gift; the firmware must be simple and hard to break.

### D2. Retry up to 3 times, then give up until the next cycle
If Wi-Fi or the API fails, retry up to 3 times. If all fail, go back to sleep and try next cycle.
The e-paper keeps showing the last image, so a failed cycle is invisible.

### D3. Fixed 3-hour cycle, aligned to the clock (see D24)
Wakes happen at fixed 3-hour marks of local time (00:00, 03:00, 06:00, …), not "3 hours from now".
**Why:** simplicity. A server-controlled interval (`X-Sleep-Seconds` header) was considered and
deferred; revisit if this ever becomes a product.

### D24. NTP time sync for clock-aligned wakes
After Wi-Fi connects, the firmware syncs time via SNTP and sleeps until the next 3-hour mark
in local time. The POSIX TZ string is hardcoded in the firmware (like the Wi-Fi credentials).
If NTP fails, fall back to sleeping 3 hours from now.
**Why:** removes deep-sleep timer drift; frames scheduled on a mark show up within minutes.

### D4. Image format: raw 48000-byte, 1bpp buffer
The API returns the image already packed for the Waveshare 7.5" V2 (800×480, black/white),
in the panel's native bit packing (verified). The firmware does no image processing; the
server does resize/dither/pack.

### D5. Download fully into RAM and validate before touching the display
The firmware buffers the whole response, and only draws if the request succeeded and exactly
48000 bytes were received. Otherwise the cycle counts as a failure and the display is untouched.
**Why:** a partial download drawn to the panel would show garbage for 3 hours.

### D6. Always USB-powered, no battery
Power consumption is not a design concern for now.

### D7. Wi-Fi credentials hardcoded
SSID/password are compiled into the firmware. Changing networks requires a reflash.

### D8. API protected by a key, hardcoded in the firmware
The API is only accessible with a key, which is compiled into the firmware.

### D9. Skip unchanged images with a conditional request (ETag)
The API assigns each image an ID and returns it in the `ETag` header. The firmware sends its
last stored ID in `If-None-Match`; if the image is unchanged the server replies `304 Not Modified`
with no body and the firmware goes straight back to sleep without refreshing the panel.

```
GET /image
Authorization: Bearer <key>
If-None-Match: "<last-id>"        (omitted if no ID stored)

→ 304 Not Modified                         same image, sleep
→ 200 OK, ETag: "<new-id>", 48000 bytes    draw, then store <new-id>
```

- The ID travels in a header, so the body is exactly the 48000-byte image (keeps D5's check simple).
- The new ID is stored only **after** the image is drawn successfully, so a failed draw is retried
  next cycle.
- The key is sent in the `Authorization` header (never in the URL, which ends up in logs).

**Why:** avoids downloading 48 KB and a ~4 s full-panel flash when nothing changed.

### D10. Last image ID lives in RTC memory only (no NVS)
The ID is kept in RTC memory, which survives deep sleep but not a reset or power loss.
Losing it just costs one extra refresh, which the panel is built for.
**Why:** no flash writes needed, and every cycle stays self-contained.

### D11. Deep sleep between cycles (even though always powered)
The ESP32 deep sleeps for the 3-hour interval rather than idling awake.
**Why:** every wake is a clean boot, so leaked memory or stuck Wi-Fi state can't carry over
between cycles. Also required for D10 (RTC memory persists across deep sleep).

### D12. Forced update = reset button (no USB commands)
Pressing the board's reset (EN) button, or power-cycling, forces a full fetch and redraw:
a reset clears RTC memory (D10), so no `If-None-Match` is sent and the server returns the image.
No USB serial command parsing and no extra GPIO button.
**Why:** zero extra code; the NodeMCU board already has the button.

### D13. No OTA (over-the-air) firmware updates
Firmware is only updated by flashing over USB.
**Why:** keeps the firmware simple; the owner has physical access to the frame to reflash if needed.
Revisit if this becomes a product (note: adding OTA later requires one USB flash first).

## API / web app

### D14. One Spring Boot app: Thymeleaf web app + one REST endpoint for the device
`inkpost-api` is both the web app used to create and manage frames, and the API the device calls.
The web app is a "super simple Canva": upload photos and convert them to 1-bit with adjustable
grayscale/dither settings, draw pixel art, shapes (with fill), and text. Frames are saved, each
can be packed into the 48000-byte format, and frames can be scheduled for display.

### D15. Hosted on a home server, exposed via Cloudflare Tunnel

### D16. Web UI protected by Cloudflare Access
Cloudflare Access (email login) sits in front of the web UI; no auth code in Spring.
The device endpoint is excluded from Access and protected only by the API key (D8).
The device endpoint sends `Cache-Control: no-store` so Cloudflare never caches it.
**Why:** simplest option; no login system to build.

### D17. ETag = hash of the packed 48000 bytes
Not the frame's database ID. The ETag changes exactly when the displayed pixels change, so
editing a frame automatically triggers a refresh. Tolerate a `W/` (weak) prefix that Cloudflare
may add.

### D18. Pixel-only editor (Paint-style), no editable objects
Everything drawn (pixels, shapes, fills, text) is rasterized into the 800×480 1-bit bitmap
immediately. No object model, selection, or re-editable text.
**Why:** Canva-style editable objects are several times the work.

### D19. The browser is the only renderer
The editor runs on a JS `<canvas>`; the browser produces the final 800×480 1-bit image and
uploads it. The server validates and packs it into the 48000-byte format.
**Why:** what the editor previews is exactly what the frame shows; no second renderer in Java
to keep in sync (fonts, anti-aliasing, dithering would differ).

### D20. Thymeleaf for all pages; the editor is plain JS, no frontend framework
All pages are server-rendered Thymeleaf. The editor page loads a plain JS module from
`src/main/resources/static`. No React/Vue, no separate frontend build.
**Why:** one app, one deploy, Cloudflare Access covers everything; a framework doesn't help with
imperative canvas drawing.

### D21. Single bitmap, no layers
The editor works on one 800×480 1-bit bitmap with undo. Consequence: an imported photo is
dithered once (with the slider settings) and becomes plain pixels; to re-dither, re-import.

### D22. One font, three sizes
Text uses a single font family with only three predefined sizes. Exact font and sizes to be
chosen by prototyping what looks best in 1-bit.

### D23. Schedule is a timeline of "from this date-time, show this frame"
Each schedule entry is (start date-time, frame). The current frame is the entry with the latest
start ≤ now; it stays displayed until the next entry starts.
Example: A at 14 Feb 11:00, B at 14 Feb 19:00 → a request on 14 Feb 13:00 gets A; any request
from 14 Feb 19:00 onward (e.g. 16 Feb) gets B.
Because the device wakes every 3 hours, a frame appears between its start time and ~3 hours later.

### D25. Wake 1–2 minutes after each mark
The firmware targets e.g. 12:01, not 12:00, so small clock differences between the device and
the server never make it fetch just before a schedule entry starts.

### D26. Schedule times can only be on the 3-hour marks
The schedule UI only offers 00:00, 03:00, 06:00, … 21:00, so the schedule always matches when
the frame actually wakes.

### D27. Schedule edge cases
- No entry has started yet → the device endpoint returns `404`; the firmware treats it as a
  failure and leaves the display untouched (D5).
- Device and server use the same explicitly configured timezone (server: `application.properties`,
  firmware: POSIX TZ string). Zone to be filled in.
- A frame that appears in the schedule cannot be deleted; remove it from the schedule first.

## Guiding principle

Prefer doing a few things well over supporting many features or edge cases. When in doubt,
pick the option with fewer cases to handle.

## Open questions

- Which font and which 3 sizes (prototype).
- Who uses the web UI (just the owner, or the girlfriend too)?
- Storage (database, where photos live, backups).
