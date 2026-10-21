# inkpost-api

Spring Boot app that serves the frame's images and the web UI. Read the root `AGENTS.md` and
`docs/DECISIONS.md` first.

## Running

The JDK is pinned with mise (`mise.toml`, Temurin 27). Run Gradle through it:

- `mise exec -- ./gradlew test`
- `mise exec -- ./gradlew bootRun`, then:
  - `/actuator/health`: health check
  - `/swagger-ui.html`: API docs (springdoc)

## Layering: controller → service → repository

- **Controllers** only do HTTP: bind params, call one service, build the response (status, headers,
  content type). No logic.
- **Services** do the work.
- **Repositories** handle persistence. Add them only once something is stored.
- Code is grouped by feature (`display/`, …). Cross-cutting setup lives in `config/`.
- OpenAPI annotations belong on controllers.

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

`display/MonoBitmap` is the only place that knows the 48000-byte packing (D4). Reuse it, don't
re-implement it.

## Git

Commit only `inkpost-api/` paths (`git add inkpost-api/`). Another agent works on the firmware in the
same checkout.
