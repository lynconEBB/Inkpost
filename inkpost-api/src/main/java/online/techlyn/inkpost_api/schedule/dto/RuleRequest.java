package online.techlyn.inkpost_api.schedule.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

/**
 * A rule to create or replace (D38). Each pattern list is a set of allowed values: missing or null
 * means every value, duplicates are ignored (D41).
 */
public record RuleRequest(
		@Schema(example = "Viagem")
		@NotBlank @Size(max = 100) String name,

		@Schema(description = "Brasília local time on a 3-hour mark; null = no start", example = "2026-11-20T00:00:00")
		LocalDateTime startAt,

		@Schema(description = "Exclusive, after startAt, on a 3-hour mark; null = no end", example = "2026-11-30T00:00:00")
		LocalDateTime endAt,

		@Schema(description = "0-23, in whole 3-hour blocks (0-2, 3-5, ..., 21-23); null = every hour")
		@Size(min = 1, message = EMPTY) List<@NotNull @Min(0) @Max(23) Integer> hours,

		@Schema(description = "1-31; null = every day")
		@Size(min = 1, message = EMPTY) List<@NotNull @Min(1) @Max(31) Integer> daysOfMonth,

		@Schema(description = "1-12; null = every month")
		@Size(min = 1, message = EMPTY) List<@NotNull @Min(1) @Max(12) Integer> months,

		@Schema(description = "1 = Monday ... 7 = Sunday (ISO); null = every weekday")
		@Size(min = 1, message = EMPTY) List<@NotNull @Min(1) @Max(7) Integer> weekdays,

		@Schema(description = "In rotation order, repeats allowed; at least one, except for the default rule")
		@NotNull List<@NotNull Integer> frameIds) {

	private static final String EMPTY = "must not be empty; leave it out for every value";

}
