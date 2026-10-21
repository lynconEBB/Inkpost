package online.techlyn.inkpost_api.schedule.model;

import java.util.List;
import online.techlyn.inkpost_api.schedule.entity.Rule;

/**
 * The schedule over a range (D39): one track per rule that covers part of it, highest priority first,
 * and what is on air. Intervals are in time order, consecutive hours merged.
 */
public record Timeline(List<Track> tracks, List<OnAir> onAir) {

	/** The hours a rule covers, whether it wins them or not. */
	public record Track(Rule rule, List<Interval> covers) {
	}

	/** When a rule wins. */
	public record OnAir(Rule rule, Interval interval) {
	}

}
