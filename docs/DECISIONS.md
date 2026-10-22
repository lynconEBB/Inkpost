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
Exact rule: wake 1 min past (D25) the next mark that is at least 5 min away. After power-on the
first wake is that next mark (14:30 → 15:01, 14:57 → 18:01); after that it is always 00:01,
03:01, …, 21:01. The 5 min also absorbs a slightly early wake (17:59:50 → 21:01, not 18:01 again).
**Why:** simplicity. A server-controlled interval (`X-Sleep-Seconds` header) was considered and
deferred; revisit if this ever becomes a product.

### D24. NTP time sync for clock-aligned wakes
After Wi-Fi connects, the firmware syncs time via SNTP and sleeps until the next 3-hour mark
in local time. The POSIX TZ string is hardcoded in the firmware (like the Wi-Fi credentials):
`"<-03>3"`, Brasília (D27).
If NTP fails, the clock kept through deep sleep is used, as long as it was set since power-on
(D36: it drifts about 0.1 %). Only if it was never set does the firmware sleep 3 hours from now.
**Why:** removes deep-sleep timer drift; frames scheduled on a mark show up within minutes.

### D4. Image format: raw 48000-byte, 1bpp buffer
The API returns the image already packed for the Waveshare 7.5" V2 (800×480, black/white),
in the panel's native bit packing (verified). The firmware does no image processing; the
server does resize/dither/pack.
Exact format: 1 bit per pixel, bit 1 = white, 0 = black; rows top to bottom, 100 bytes each;
the most significant bit of each byte is the leftmost pixel. This is the format the
`epaper_test` prototype's pixel art was verified with.

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
GET /api/image
Authorization: Bearer <key>
If-None-Match: "<last-id>"        (omitted if no ID stored)

→ 304 Not Modified                         same image, sleep
→ 200 OK, ETag: "<new-id>", 48000 bytes    draw, then store <new-id>
```

- The ID travels in a header, so the body is exactly the 48000-byte image (keeps D5's check simple).
- The new ID is stored only **after** the image is drawn successfully, so a failed draw is retried
  next cycle. A failed draw also clears the stored ID (D46).
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

### D28. Firmware modules: one header + one `.c` in `main/`, blocking API, no callbacks
Each abstraction (`ink_wifi`, `ink_http`, `ink_display`, `ink_time`, `ink_api`) is a header we
call and a `.c` that implements it, all in `main/`. No ESP-IDF components: the separation is ours
to keep (only use a module through its header). Every call blocks until done; the ESP-IDF event
machinery stays inside the `.c`.
The `ink_` prefix avoids clashes with ESP-IDF names (`wifi_*`, `HTTP_GET`).
**Why:** the code is only used by this project; blocking calls make the cycle (D1) read top to bottom.

### D29. HTTP layer contract
- HTTPS is always verified against the ESP-IDF certificate bundle.
- `ink_http_request` returns `ESP_OK` whenever a complete response arrived, whatever the status
  code; the status, all response headers and the body are in the response struct.
- The whole body is buffered in RAM, up to a max size (default 64 KB). A body cut short is an
  error, never a success (D5).
- GET only, redirects not followed. POST can be added later as new request fields.
- Response headers are collected by our own code: ESP-IDF's built-in saving keeps only 10, and
  Cloudflare sends more, so the ETag (D9) could be lost.

### D30. Secrets live in a gitignored `main/secrets.h`
Refines D7: Wi-Fi credentials, the image URL and the device key (`DEVICE_KEY`, D8) are still
compiled in, but from `main/secrets.h`, which is not committed. `main/secrets.h.example` is the
template to copy.

### D31. Tests are on-device integration tests
`inkpost-firmware/test/` is a separate ESP-IDF project that compiles the modules from `main/` and
runs Unity tests on the real board, against the real Wi-Fi and real HTTPS servers (httpbin.org,
badssl.com). No host-side mocks.
**Why:** Wi-Fi only exists on the device, and mocking `esp_http_client` would only test the mock.

### D32. Single large app partition (1.5 MB)
Wi-Fi + TLS alone already took 0.97 MB of the default 1 MB app partition. Without OTA (D13) one
big app slot is enough.

### D33. Display module: init / draw / clear / draw_checker / deinit
`ink_display` drives the 7.5" V2 panel through the e-Paper Driver HAT Rev2.3, using the protocol
of Waveshare's reference driver (ported via the `epaper_test` prototype). Full refreshes only.
The panel is powered through the HAT's PWR pin only between init and deinit.
`draw_checker` draws a test pattern; the wiring and HAT switch settings are at the top of
`ink_display.c`.
**Why:** the cycle (D1) needs nothing more; Waveshare warns against leaving a panel powered.
After deinit, PWR (GPIO32, an RTC pin) is held low with `gpio_hold_en`, so the panel stays
unpowered through deep sleep instead of the pin floating.

### D34. Display failures are errors, never a silent success
SPI to the panel is one-way, so failures are detected through the BUSY pin: the panel never
becoming ready (`ESP_ERR_TIMEOUT`) or never starting a refresh (`ESP_ERR_INVALID_RESPONSE`).
Every error is returned, nothing aborts.
**Why:** a draw that reports success with nothing drawn would make the firmware store the new
ETag (D9), and that image would never be retried.

### D35. Forced full redraw once a day
Waveshare recommends refreshing the panel at least once every 24 hours, and refreshes at least
180 s apart. With D9 alone, an unchanged image would never be redrawn. So the wake at the 00:00
mark (00:01, D25) sends no `If-None-Match`, the server returns the image, and the panel is
redrawn. If NTP failed on that wake (D24), the time is unknown and it is a normal wake.
How the firmware recognizes that wake is in D46.
The 3-hour cycle (D3) already keeps refreshes far more than 180 s apart.
**Why:** keeps the panel healthy, and at night nobody sees the ~4 s flash.

### D36. RTC clock source: internal 8.5 MHz ÷ 256, no SNTP startup delay
Measured on the frame's board against NTP (three 10-minute deep sleeps each):
- Internal 150 kHz RC (ESP-IDF default): 1.3–2.3 % fast, changing with temperature. That is
  about 2.5–4 min early per 3 h sleep, enough to fetch before the mark (D25).
- Internal 8.5 MHz ÷ 256: a steady 0.1 % slow, about 11 s late per 3 h sleep.
The firmware uses 8.5 MHz ÷ 256 (`CONFIG_RTC_CLK_SRC_INT_8MD256`, `CONFIG_RTC_CLK_CAL_CYCLES=3000`,
as measured). Its extra 5 µA of sleep current doesn't matter on USB power (D6). An external
32 kHz crystal would need GPIO32/33, and GPIO32 is the display's PWR pin.
`CONFIG_LWIP_SNTP_STARTUP_DELAY` is off: its random 0–5 s wait before the first NTP request is
for fleets of devices, and for one frame it only delays every wake.

### D37. `ink_time` module, and `main.c` is just the cycle
`ink_time` does NTP sync, current local time, rounding up to N-hour marks, seconds until a time,
and deep sleep. `main.c` runs the cycle (D1): up to 3 attempts (D2) of Wi-Fi, NTP, fetch and draw,
then Wi-Fi off and deep sleep until the next wake (D3). Deep sleep never returns: every wake
starts `app_main` from the top, so there is no loop in the code (D11).
Each fetch sends the device key and, unless it is the daily redraw (D35), `If-None-Match` (D46).

### D46. `ink_api`: the firmware's side of the device endpoint
`ink_api_get_image` is the device endpoint's protocol (`GET /api/image`, D9): it sends the key in
`Authorization` and, when given an ETag, `If-None-Match`, and only returns `ESP_OK` for a `304` or a
`200` of exactly 48000 bytes (D5). Any other status is `ESP_ERR_INVALID_RESPONSE`. It is stateless:
`main.c` keeps the ETag of the image on the panel in RTC memory (D10).
- `401` (wrong key) and `404` (nothing scheduled, D27) are failures like any other, retried as in D2
  with no special rules (guiding principle). Each retry still advances the rotation (D38).
- The ETag is stored and sent back verbatim, quotes and any `W/` prefix included (D17). One longer
  than 79 characters is treated as absent: the next request is unconditional, which costs at most
  one redraw.
- A failed draw clears the stored ETag (refines D9, which assumed one image, not a rotation). After
  a failed refresh the panel's content is unknown, so the next request must get a `200`, not a `304`
  for the frame that was there before. Any other failure leaves the ETag alone: the panel wasn't
  touched.
- The daily redraw wake (D35) is the one whose nearest 3-hour mark is 00:00, i.e. local time
  22:30–01:30, so a slightly early wake (23:59:50, D3) counts too. `main.c` rounds now − 90 min up to
  a 3-hour mark and checks for hour 0.

**Why:** `main.c` stays just the cycle (D37), and the status and ETag handling is tested on the
board (D31).

## API / web app

### D14. One Spring Boot app: Thymeleaf web app + one REST endpoint for the device
`inkpost-api` is both the web app used to create and manage frames, and the API the device calls.
The web app is a "super simple Canva": upload photos and convert them to 1-bit with adjustable
grayscale/dither settings, draw pixel art, shapes (with fill), and text. Frames are saved, each
can be packed into the 48000-byte format, and frames can be scheduled for display.

### D15. Hosted on a home server, exposed via Cloudflare Tunnel

### D16. Web UI protected by Cloudflare Access
Cloudflare Access (email login) sits in front of the web UI; no auth code in Spring.
The device endpoint (`GET /api/image`, D41) is excluded from Access and protected only by the API key (D8).
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

### D23. Replaced by D38 (was: schedule as a timeline of "from this date-time, show this frame")
A timeline of single (start date-time, frame) entries can't express repeating or rotating content.

### D25. Wake 1–2 minutes after each mark
The firmware targets e.g. 12:01, not 12:00, so small clock differences between the device and
the server never make it fetch just before a schedule entry starts.

### D26. Schedule times can only be on the 3-hour marks
The schedule UI only offers the 3-hour blocks starting at 00:00, 03:00, 06:00, … 21:00 (D38),
so the schedule always matches when the frame actually wakes.

### D27. Schedule edge cases
- No rule covers now (only possible while the default rule has no frames, D38) → the device
  endpoint returns `404`; the firmware treats it as a failure and leaves the display untouched (D5).
- Device and server use the same explicitly configured timezone (server: `application.properties`,
  firmware: POSIX TZ string). The zone is Brasília: `America/Sao_Paulo` on the server, `"<-03>3"`
  in the firmware (UTC−3, no daylight saving time).
- A frame used in a rule cannot be deleted; remove it from the rule first.

### D38. Schedule = prioritized rules: a cron-like hour pattern inside a date window, rotating frames
Replaces D23. A rule has:
- A window: `start_at` and `end_at` date-times, both optional, `end_at` exclusive.
- An hour pattern, like cron without minutes: hours, days of the month, months and weekdays.
  Each field is a set of allowed values stored as a bitmask (`*` = all bits set, never null).
- An ordered list of frames: at least one, except the default rule, which may be empty.

A rule **covers** an instant when the instant is inside the window and its hour, day, month and
weekday all match. Day of the month and weekday combine with AND (cron uses OR when both are
restricted): "day 13 + Friday" is Friday the 13th. Day 31 simply never matches in shorter months.
A matched hour is owned for the whole hour (06:00–06:59), not a one-off trigger like in cron.
Hours are local time (D27); Brasília has no daylight saving time, so no hour is skipped or repeated.

Which rule wins:
- Rules are an ordered list; the highest one that covers now wins. A new rule goes on top, and
  the list can be reordered.
- A default rule sits at the bottom, covers everything, has no window, and cannot be deleted or
  moved. When an event ends, the display falls back to whatever rule is below it.

Rotation advances per request: each device request that resolves to a rule gets
`frames[next_position % n]`, and `next_position` is incremented in the same transaction.
- When a higher rule takes over, the rotation pauses and resumes where it was (nothing is skipped).
- A fetch or draw that fails after the server answered still consumes a frame; the retry (D2) gets
  the next one. Accepted: it is rare, and nobody notices it in a photo rotation.
- Every call to the device endpoint advances, including the reset button (D12 becomes "next
  frame") and manual curl/Swagger calls. The web UI never calls it; it uses a read-only resolve.
- If the next frame has the same pixels as the one shown, the answer is `304` (D9) and the
  rotation still advances.
- The web UI shows which rule and which set of frames covers each moment, not the exact frame.
  For a specific "photo of the day", create a one-day rule (or one repeating on a day of the month).

The device only wakes at the 3-hour marks (D3), so the UI only offers 3-hour blocks (D26), and each
block sets its 3 hour bits (the 06:00 block = hours 6, 7, 8). If the device ever wakes more often,
the stored rules already mean the right thing; only that validation is relaxed.
Not supported: minutes; cron's `L`, `W` and `#` (last day of the month, nearest weekday, n-th
weekday of the month); a year field (the window covers it).

Data model (the full schema is in the Flyway migrations, D40):

```
rule       (id, name, priority, is_default, start_at?, end_at?,
            hours,                  -- 24 bits, bit h = hour h
            days_of_month,          -- 31 bits, bit d-1 = day d
            months,                 -- 12 bits, bit m-1 = month m
            weekdays,               -- 7 bits, bit 0 = Monday (ISO)
            next_position)
rule_frame (rule_id, position, frame_id)
```

**Why:** one kind of rule covers a single slot, a consecutive range, weekly and yearly repeats,
and rotations. Request-driven rotation needs no counting over time and pauses naturally under
higher rules; its costs (no exact preview of the future, a frame lost on a rare failure) are fine
for a gift.

### D39. Schedule timeline: one track per rule; the server computes, the page only draws
The web UI shows the schedule a week at a time, Monday 00:00 to the next Monday 00:00, with **days as
rows**, so it scrolls vertically and fits a phone without scrolling sideways. Each day has 24 hour
columns, labeled every 3 hours, and tracks like a video editor's:
- an **on air** row, in the color of the rule that wins each hour;
- one track per rule that covers part of that day, highest first, so an upper track shows over the
  lower ones. A track is solid where its rule is on air, and hatched where it covers the hour but a
  higher rule wins. Rule names sit in a label column, cut short on phones.

Tapping a track opens its rule. Today is marked, with a line at the current time. On a desktop the
days scroll inside the timeline, which opens on today; on a phone the page itself scrolls, so it opens
at the top, with the "now on the frame" card first, and the "Today" button goes to today.
Brasília has no daylight saving time (D27), so day *k* of a range starts at `from + k × 24 h`
(`timeline-days.js`).

```
GET /api/timeline?from=2026-10-19T00:00:00&to=2026-10-26T00:00:00

{
  "version": 42,
  "rules": [
    { "id": 7, "name": "Trip", "priority": 2, "isDefault": false, "frameIds": [12, 15],
      "covers": [ { "start": "2026-10-21T00:00:00-03:00", "end": "2026-10-23T00:00:00-03:00" } ] },
    { "id": 1, "name": "Default", "priority": 0, "isDefault": true, "frameIds": [1, 2, 3],
      "covers": [ { "start": "2026-10-19T00:00:00-03:00", "end": "2026-10-26T00:00:00-03:00" } ] }
  ],
  "onAir": [
    { "start": "2026-10-19T00:00:00-03:00", "end": "2026-10-21T00:00:00-03:00", "ruleId": 1 },
    { "start": "2026-10-21T00:00:00-03:00", "end": "2026-10-23T00:00:00-03:00", "ruleId": 7 },
    { "start": "2026-10-23T00:00:00-03:00", "end": "2026-10-26T00:00:00-03:00", "ruleId": 1 }
  ]
}
```

`from` and `to` are whole hours, `from < to`, at most 62 days apart (otherwise `400`, D41).

- `rules`: the rules that cover at least one hour of the range, highest priority first. `covers`
  is what each one covers; `onAir` is which rule wins. Both are computed with the same code the
  device endpoint uses (D38).
- Intervals are `[start, end)`, ISO-8601 with the offset, consecutive hours merged, and clipped to
  the requested range. They stay the same if the device ever wakes every hour.
- The page (a plain JS module, D20) has no rule logic: it draws `covers` hatched and the rule's
  `onAir` parts solid on top. Times are always shown in Brasília time (`Intl.DateTimeFormat` with
  `timeZone: "America/Sao_Paulo"`), whatever the browser's zone.
- The page can keep the ranges it already loaded while the user navigates: concatenate the lists
  and merge intervals of the same rule where one ends exactly where the next starts. Responses are
  clipped to their range, so they never overlap. Kept in memory only, never in `localStorage`.
- `version` is a counter incremented on every rule change (create, edit, delete, reorder, frame
  list). A response with a different version drops everything loaded and reloads the visible range.
  Device requests don't change it: the timeline shows sets of frames, not the exact frame (D38).
- Rule colors come from a palette of 8 by rule id (`colors.js`), with the default rule always gray;
  they are not stored. The rule list uses the same colors.

"Now on the frame" card: `GET /api/device` returns the last device request (time, rule, frame),
written in the same transaction that advances the rotation (D38). With no request for more than
3 h 15 min, the frame missed a wake and the card shows it as offline. It is a separate endpoint
because it changes on every wake and must not be kept with the timeline.

Both endpoints are part of the web UI: behind Cloudflare Access (D16), not the device key (D8).

**Why:** the rule semantics live in one place, like the renderer in D19. A second copy in JS would
have to match the timezone, the AND between day of the month and weekday, the exclusive end and
day 31, and computing it costs nothing for one user. Intervals are what the page draws, and they
merge cleanly across ranges.

### D40. SQLite in one file; only Flyway changes the schema
Everything the API stores is in one SQLite file, through JPA: frames (as 48000-byte BLOBs), rules,
and a single-row `app_state` (the schedule version and the last device request, D39). Only Flyway
migrations create or change the schema; Hibernate just validates it at startup.
- SQLite is a library inside the app, not a server: there is no container for it. The file is
  `inkpost.db` in the working directory, or `INKPOST_DB_PATH`. If the app runs in Docker, the file
  goes in a mounted volume.
- One connection (a pool of 1): SQLite allows one writer at a time, and there is one user.
- Foreign keys are off by default in SQLite; the connection URL turns them on.
- Date-times are stored as ISO-8601 text in Brasília local time (D27), truncated to seconds
  (`2026-10-21T15:00:00`): readable, and they compare correctly as text. sqlite-jdbc would
  otherwise store epoch milliseconds.
- SQLite's `ALTER TABLE` is limited: a migration that changes a column rebuilds the table.
- Tests run against a fresh in-memory database per Spring context, migrated by Flyway.
**Why:** one user and little data (a thousand frames is about 48 MB). A backup is a copy of one
file, and tests need no Docker. Postgres would add a server to run, dumps and Testcontainers.

### D41. REST API conventions
- Every endpoint is under `/api/`. All are the web UI's, behind Cloudflare Access (D16) with no auth
  in the app, except `GET /api/image`, the frame's: Access excludes that one path, and the app checks
  the device key on it (D8).
- JSON in and out. Date-times in requests are Brasília local time without an offset
  (`2026-10-21T15:00:00`); in responses they carry the offset (`2026-10-21T15:00:00-03:00`), so a
  page never has to guess the zone (D27).
- Errors are RFC 9457 Problem Details (`application/problem+json`): `400` invalid input, with an
  `errors` array of `{ "field", "message" }`; `404` unknown ID; `409` conflicts with the current
  state (e.g. deleting a frame a rule uses, D27); `413` upload too large. Bean Validation checks
  shapes, services check domain rules, and both produce the same `400`.
- Lists, not bitmasks: a rule's hours, days of the month, months and weekdays are lists of values
  in the API (`"weekdays": [6, 7]`). In a request, a missing or null list means every value; in a
  response, every value is always listed. The bitmasks (D38) are only how they are stored.
- Strict PNG upload: a frame is uploaded as a PNG of exactly 800×480 where every pixel is opaque
  pure black (`#000000`) or pure white (`#FFFFFF`). Anything else is a `400` naming the problem
  (e.g. the first wrong pixel). The server never thresholds or dithers. Uploads are capped at 2 MB.
**Why:** one error shape for every page to show. Lists say what they mean, and the bit layout stays
in one place. A server that fixed up images would show something the editor didn't preview; the
browser is the only renderer (D19).

### D42. Web UI: Thymeleaf shells, plain JS modules that call the API
- **Shells:** Thymeleaf renders each page's markup, and a plain JS module (D20) fills it from
  `/api/**`. There are no server-rendered forms: the API already has every endpoint the pages need.
- **Page controllers:** one `@Controller` per domain (`SchedulePageController`, `FramePageController`)
  only returns the view name, plus the rule ID on the edit page. They stay out of the OpenAPI docs.
- **Errors:** `ApiExceptionHandler` only handles `@RestController`s, so API errors stay Problem Details
  (D41), while page errors (an unknown URL, a 500) get Boot's error page, `templates/error.html`.
  A too large upload fails before Spring chooses a handler, so `UploadSizeExceptionHandler` keeps
  that `413` in Problem Details. Other errors of that kind, like an unknown `/api/` URL, get Boot's
  JSON error: only a bug or a hand-written request makes them.
- **Templates:** `layout.html` holds the fragments `head(title)` and `header(page)`, with no Layout
  Dialect. Repeated markup (rule rows, frame cards, timeline days) lives in `<template>` elements that
  the JS clones, so the JS builds no HTML strings. IDs reach the JS as `data-*` attributes.
- **Scripts:** `<script type="module">`, importing each other by relative path. No bundler, no npm
  packages, no framework.
- **Logic stays out of the DOM:** everything that can be wrong (dates, summaries, timeline days, crop,
  dithering) lives in DOM-free modules, tested with `node --test`.
- **Times:** always shown in Brasília time (D39), and request date-times are built as local strings
  straight from the inputs (D41), never through `Date`.
- **English:** the UI is in English, with the strings inline in the templates and the JS, and no
  i18n machinery.
- **Caching:** static files are sent with `Cache-Control: no-cache`. Cloudflare caches `.js` and
  `.css` by extension, and a deploy has to show up right away.
- Pages and static files sit behind Cloudflare Access like `/api/**` (D16).

**Why:** one app and one deploy (D20), and the pages only draw what the API computes (D39). Plain
modules need no build step, and the DOM-free ones are tested without a browser.

### D43. Responsive: phone first
Every page works on a phone and on a desktop.
- **Breakpoints:** the base CSS is the phone layout. `min-width: 40rem` is for large phones and
  tablets, and `min-width: 64rem` for desktops, with two columns on the schedule and upload pages.
- **Width:** from 320 px, with no horizontal scrolling. Content is at most `72rem` wide, centered, with
  `1rem` gutters. Sizes are in `rem` and grids are fluid; the only fixed pixel size is the canvas's
  800×480 backing size.
- **Touch:** tap targets are at least 44×44 px, nothing works only on hover, inputs are at least
  16 px (or iOS zooms in on focus), and dates and selects are native inputs, so phones show their own
  pickers. Zoom is never disabled. Where 44 px doesn't fit, the layout gives way, never the target: the
  days of the month are 7 chips a row from 360 px, and 6 on a 320 px phone.
- **Dialogs** are full screen on phones (`100dvh`) and a centered box from `40rem`.
- **Main action:** Save and Upload sit in a sticky bar at the bottom on phones, padded with
  `env(safe-area-inset-bottom)`.
- **Accessibility:** every input has a label, focus is visible, and color is never the only cue.
- Checked at 320×568, 390×844, 768×1024, 1280×800 and 1920×1080.

**Why:** the content changes throughout the day, from wherever the owner is, so a phone is the
first screen to design for.

### D44. Photos become frames in the browser
The upload page turns a photo into the 800×480 PNG of pure black and white that D41 accepts; the
browser is the only renderer (D19).
- **Decode:** `createImageBitmap` with the EXIF orientation applied, so phone photos stay upright. A
  file the browser can't decode (e.g. HEIC on a desktop) gets "Can't read this image, use a JPEG or
  PNG".
- **Crop to fill:** the photo is scaled to cover 800×480 and centered. Dragging (Pointer Events, mouse
  and touch) moves it, clamped so the frame is always covered, so only one axis moves. No zoom or
  rotation.
- **Adjust:** brightness and contrast (−100 … 100), and the dithering: Floyd–Steinberg (the default,
  serpentine), Atkinson, or a 50% threshold. The preview is the dithered result; while dragging it
  shows the grayscale crop and dithers on release.
- **Upload:** every pixel exactly 0 or 255 with alpha 255, then `canvas.toBlob(…, "image/png")`, sent
  with the name (by default the file name) to `POST /api/frames`.
- `dither.js` works on plain arrays and knows nothing about the DOM, so the editor's photo import
  reuses it (D21).

**Why:** what the preview shows is exactly what the frame shows. Dithering an 800×480 crop takes a few
milliseconds, so the sliders can re-dither on every animation frame.

### D45. The rule form asks for the last block shown
A rule's end is exclusive (D38): a rule from the 20th to the 29th ends on 30 Nov at 00:00. The form's
"Until" asks instead for the last date and block the rule covers, inclusive (21:00–24:00 by default),
and sends `endAt` = that block + 3 h. On load it shows `endAt − 3 h`.
- "Starts" is a date and the block the rule starts with (00:00 by default). No date means no start, or
  no end (`null`).
- The summaries (`rule-summary.js`, the same on the rule list and the form) read the same way: an end at
  midnight shows the day before ("20 Nov → 29 Nov"), any other end its time ("29 Nov 12:00").
- The pattern fields are chips: the time of day is the 8 blocks (D26), sent as their hours. A field with
  every chip checked is sent as `null`, every value (D41), and collapses to one line ("Every month ·
  Change"). None checked is an error in the form, never sent.

**Why:** "until 29 Nov" includes the 29th to anyone who reads it, and asking for the day after would be
off by one in every rule. The stored end stays exclusive, so the rule semantics (D38) and the API (D41)
don't change.

## Guiding principle

Prefer doing a few things well over supporting many features or edge cases. When in doubt,
pick the option with fewer cases to handle.

## Open questions

- Which font and which 3 sizes (prototype).
- Backups of the SQLite file (D40).
