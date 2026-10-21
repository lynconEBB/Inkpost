package online.techlyn.inkpost_api.schedule.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * The schedule over a range, as the timeline page draws it (D39). {@code rules} are those covering at
 * least one hour of the range, highest priority first; {@code onAir} is which rule wins. Intervals are
 * {@code [start, end)}, consecutive hours merged, clipped to the range.
 */
public record TimelineResponse(int version, List<Track> rules, List<OnAir> onAir) {

	/** A rule's track: everything it covers, whether it wins or not. */
	public record Track(Integer id, String name, int priority, boolean isDefault, List<Integer> frameIds,
			List<Interval> covers) {
	}

	public record Interval(OffsetDateTime start, OffsetDateTime end) {
	}

	public record OnAir(OffsetDateTime start, OffsetDateTime end, Integer ruleId) {
	}

}
