package online.techlyn.inkpost_api.schedule.model;

import java.time.LocalDateTime;

/** {@code [start, end)} in Brasília local time (D27, D39). */
public record Interval(LocalDateTime start, LocalDateTime end) {
}
