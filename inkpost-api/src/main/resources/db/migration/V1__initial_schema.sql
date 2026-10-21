-- Frames, schedule rules and app state (D38, D39, D40).
-- Date-times are ISO-8601 text in Brasília local time, e.g. 2026-10-21T15:00:00 (D27).

CREATE TABLE frame (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    bitmap     BLOB    NOT NULL CHECK (length(bitmap) = 48000), -- packed for the display (D4)
    created_at TEXT    NOT NULL
);

CREATE TABLE rule (
    id            INTEGER PRIMARY KEY,
    name          TEXT    NOT NULL,
    priority      INTEGER NOT NULL,           -- the highest covering rule wins; the default rule is 0
    is_default    BOOLEAN NOT NULL DEFAULT 0,
    start_at      TEXT,                       -- null = no start
    end_at        TEXT,                       -- exclusive; null = no end
    hours         INTEGER NOT NULL,           -- 24 bits: bit h = hour h
    days_of_month INTEGER NOT NULL,           -- 31 bits: bit d-1 = day d
    months        INTEGER NOT NULL,           -- 12 bits: bit m-1 = month m
    weekdays      INTEGER NOT NULL,           -- 7 bits: bit 0 = Monday (ISO)
    next_position INTEGER NOT NULL DEFAULT 0, -- next frame to serve, modulo the number of frames
    CHECK (start_at IS NULL OR end_at IS NULL OR start_at < end_at)
);

-- A rule's frames, in rotation order. A frame used by a rule can't be deleted (D27).
CREATE TABLE rule_frame (
    rule_id  INTEGER NOT NULL REFERENCES rule (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    frame_id INTEGER NOT NULL REFERENCES frame (id) ON DELETE RESTRICT,
    PRIMARY KEY (rule_id, position)
);

-- A single row.
CREATE TABLE app_state (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    schedule_version INTEGER NOT NULL DEFAULT 0, -- incremented on every rule change (D39)
    last_request_at  TEXT,                       -- last device request, for the "now on the frame" card
    last_rule_id     INTEGER REFERENCES rule (id) ON DELETE SET NULL,
    last_frame_id    INTEGER REFERENCES frame (id) ON DELETE SET NULL
);

-- The default rule: covers every hour (all bits set), with no window and no frames yet.
INSERT INTO rule (name, priority, is_default, hours, days_of_month, months, weekdays)
VALUES ('Padrão', 0, 1, 16777215, 2147483647, 4095, 127);

INSERT INTO app_state (id) VALUES (1);
