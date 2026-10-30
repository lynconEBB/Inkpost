# inkpost-api

Spring Boot app that serves the frame's images and the web UI. Read the root `AGENTS.md` and
`docs/DECISIONS.md` first.

## Running

The JDK and Node are pinned with mise (`mise.toml`: Temurin 27, Node 24). Run Gradle through it:

- `mise exec -- ./gradlew check`: the Java tests and the JS tests
- `mise exec -- ./gradlew test`: the Java tests only
- `mise exec -- ./gradlew jsTest`: the JS tests only, which is
  `mise exec -- node --test "src/test/js/**/*.test.js"` (Node expands the glob; it doesn't search a
  directory)
- `mise exec -- ./gradlew bootRun`, with the device key (D8) in `INKPOST_DEVICE_KEY`: the app doesn't
  start without it. Tests fall back to a key in `src/test/resources/config/`, and send whichever key is
  configured. Then:
  - `/`: the web UI
  - `/actuator/health`: health check
  - `/swagger-ui.html`: API docs (springdoc); "Authorize" with the device key to call `/api/image`

## Deploying (D55)

The app runs on the home server (`lyncon@192.168.15.58`) in `~/inkpost`, which holds only
`compose.yaml` and `.env` (the device key: `INKPOST_DEVICE_KEY=...`). Run `mise exec -- ./gradlew check`
first: the image doesn't run the tests. Then, from `inkpost-api/`:

```
docker build -t inkpost-api .
docker save inkpost-api -o /tmp/inkpost-api.tar
scp /tmp/inkpost-api.tar compose.yaml lyncon@192.168.15.58:inkpost/
ssh lyncon@192.168.15.58 'cd inkpost && docker load -i inkpost-api.tar && rm inkpost-api.tar && docker compose up -d'
```

That loads the image and (re)starts the app on the server's `127.0.0.1:8080` (`INKPOST_PORT` in
`.env` changes the port). In `~/inkpost` on the server:

- `docker compose logs -f`: the logs
- `docker compose cp inkpost-api:/data/inkpost.db .`: a copy of the database

## Layering: controller → service → repository

- **Controllers** only do HTTP: bind params, call one service, build the response (status, headers,
  content type). No logic.
- **Services** do the work, and report failures with the shared exceptions in `common/exception/`
  (`NotFoundException`, `ConflictException`, `InvalidInputException`), which
  `config/ApiExceptionHandler` turns into Problem Details (D41).
- **Repositories** handle persistence. Add them only once something is stored.
- OpenAPI annotations belong on controllers.

## Packages: domain first, then layer

Code is grouped by domain (`frame/`, `schedule/`, `testimage/`), and inside each domain by layer:

| package | contents |
|---|---|
| `controller` | `@RestController`s, and the pages' `@Controller`s (`*PageController`) |
| `service` | `@Service`s, and the plain logic classes they use |
| `repository` | Spring Data repositories |
| `entity` | JPA entities |
| `dto` | request and response bodies (records) |
| `model` | domain types that aren't stored: value objects, enums (`MonoBitmap`, `TestPattern`) |

- Package names are singular. Create a layer package only when it gets its first class; add other
  layers (e.g. `exception`) the same way when needed.
- Cross-cutting setup lives in the top-level `config/`.
- Code every domain shares lives in the top-level `common/`, by kind (`common/exception/`).
- Tests mirror the package of the class they test.

## Web UI (D42, D43)

- **Page controllers** (`*PageController`, one per domain, in `controller`) only return a view name,
  plus IDs the page needs as model attributes. All the data comes from `/api/**`.
- **Templates** are in `src/main/resources/templates/`. Every page takes `layout.html`'s fragments:
  `head(title)` for `<head>`, and `header(page)` for the header, the nav and the message area.
  `error.html` is Boot's error page for the pages.
- **Static files** are in `src/main/resources/static/`: one hand-written stylesheet, `css/app.css`,
  and the JS modules in `js/`.
- **JS conventions:**
  - Plain ES modules, loaded with `<script type="module" th:src="@{/js/...}">` and importing each
    other by relative path. No bundler, no npm packages, no framework.
  - Every API call goes through `api.js` (`api(path, { method, json, body })`), which throws an
    `ApiError` built from the Problem Details. `ui.js` shows messages and field errors, and
    `busy(button, task)` disables a button while its request runs.
  - Build no HTML strings: clone `<template>` elements from the page (`ui.clone(id)`) and set
    `textContent`. IDs reach the JS as `data-*` attributes (`th:data-rule-id="${ruleId}"`).
  - Logic that can be wrong goes in a DOM-free module (`time.js`, …) with a test in `src/test/js/`
    (`<module>.test.js`, `node:test`). Page modules only wire the DOM to them.
  - Times: through `time.js`, always in Brasília. Request date-times are local strings built from the
    inputs (`2026-11-20T06:00:00`), never through the browser's `Date`.
- **CSS** is phone first: base rules for phones, then `@media (min-width: 40rem)` and
  `(min-width: 64rem)`. Sizes in `rem`, tap targets at least `var(--tap)` (44 px), inputs at least
  16 px.

## Time

Every "now" comes from the `Clock` bean (`config/ClockConfig`, in `inkpost.timezone`, Brasília,
D27), never from `LocalDateTime.now()`, so tests can fix it.

## Persistence (D40)

- SQLite file `inkpost.db` in the working directory (`INKPOST_DB_PATH` overrides it).
- The schema comes only from Flyway migrations in `src/main/resources/db/migration`. Never edit a
  migration that was already applied; add a new one.
- SQLite `INTEGER` columns are `Integer`/`int` in Java, not `Long`: schema validation rejects
  `Long` against them.
- `LocalDateTime` is stored as ISO text by `config/LocalDateTimeTextConverter` (applied
  automatically).
- A rule's frames are mapped as frame IDs (`Rule.frameIds`), so loading rules never loads bitmaps.
- Tests get a fresh in-memory database per Spring context (`src/test/resources/config/`).
  `@DataJpaTest` needs `@AutoConfigureTestDatabase(replace = NONE)`, and must flush before
  `clear()`, or pending inserts are lost.

## Display format

`frame/model/MonoBitmap` is the only place that knows the 48000-byte packing (D4). Reuse it, don't
re-implement it.

## Git

Commit only `inkpost-api/` paths (`git add inkpost-api/`). Another agent works on the firmware in the
same checkout.
