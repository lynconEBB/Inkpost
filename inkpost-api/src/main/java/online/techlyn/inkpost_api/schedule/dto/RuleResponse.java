package online.techlyn.inkpost_api.schedule.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** A rule (D38). The pattern lists always name their values, every one of them when they mean "every". */
public record RuleResponse(
		Integer id,
		String name,
		int priority,
		boolean isDefault,
		OffsetDateTime startAt,
		OffsetDateTime endAt,
		List<Integer> frameIds,
		List<Integer> hours,
		List<Integer> daysOfMonth,
		List<Integer> months,
		List<Integer> weekdays) {
}
