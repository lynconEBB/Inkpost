package online.techlyn.inkpost_api.schedule.service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.model.Interval;
import online.techlyn.inkpost_api.schedule.model.PatternField;
import online.techlyn.inkpost_api.schedule.model.Timeline;

/**
 * What the schedule means (D38), in one place: the device endpoint and the timeline both use it (D39).
 * Hours are Brasília local time (D27), which has no daylight saving time, so every hour exists once.
 */
public final class ScheduleResolver {

	private ScheduleResolver() {
	}

	/**
	 * Whether the rule owns the hour starting at {@code hour}: the hour is inside the window
	 * ({@code startAt <= hour < endAt}) and its hour, day of the month, month and weekday all match. Day
	 * of the month and weekday combine with AND, unlike cron.
	 */
	public static boolean covers(Rule rule, LocalDateTime hour) {
		return (rule.getStartAt() == null || !hour.isBefore(rule.getStartAt()))
				&& (rule.getEndAt() == null || hour.isBefore(rule.getEndAt()))
				&& PatternField.HOURS.matches(rule.getHours(), hour.getHour())
				&& PatternField.DAYS_OF_MONTH.matches(rule.getDaysOfMonth(), hour.getDayOfMonth())
				&& PatternField.MONTHS.matches(rule.getMonths(), hour.getMonthValue())
				&& PatternField.WEEKDAYS.matches(rule.getWeekdays(), hour.getDayOfWeek().getValue());
	}

	/** The highest-priority rule that covers the hour, if any. */
	public static Optional<Rule> winner(Collection<Rule> rules, LocalDateTime hour) {
		return byPriority(rules).stream().filter(rule -> covers(rule, hour)).findFirst();
	}

	/**
	 * Hour by hour over {@code [from, to)}: what each rule covers, and the winner of each hour. Intervals
	 * are clipped to the range, so ranges that meet never overlap. Rules that cover nothing are left out.
	 */
	public static Timeline timeline(Collection<Rule> rules, LocalDateTime from, LocalDateTime to) {
		List<Rule> byPriority = byPriority(rules);
		List<List<Interval>> covers = new ArrayList<>();
		byPriority.forEach(rule -> covers.add(new ArrayList<>()));
		List<Timeline.OnAir> onAir = new ArrayList<>();

		for (LocalDateTime hour = from.truncatedTo(ChronoUnit.HOURS); hour.isBefore(to); hour = hour.plusHours(1)) {
			Interval clipped = new Interval(latest(hour, from), earliest(hour.plusHours(1), to));
			Rule winner = null;
			for (int i = 0; i < byPriority.size(); i++) {
				if (covers(byPriority.get(i), hour)) {
					append(covers.get(i), clipped);
					if (winner == null) {
						winner = byPriority.get(i);
					}
				}
			}
			if (winner != null) {
				appendOnAir(onAir, winner, clipped);
			}
		}

		List<Timeline.Track> tracks = new ArrayList<>();
		for (int i = 0; i < byPriority.size(); i++) {
			if (!covers.get(i).isEmpty()) {
				tracks.add(new Timeline.Track(byPriority.get(i), covers.get(i)));
			}
		}
		return new Timeline(tracks, onAir);
	}

	private static List<Rule> byPriority(Collection<Rule> rules) {
		return rules.stream().sorted(Comparator.comparingInt(Rule::getPriority).reversed()).toList();
	}

	/** Extends the last interval when the new one starts where it ends. */
	private static void append(List<Interval> intervals, Interval next) {
		if (!intervals.isEmpty() && intervals.getLast().end().equals(next.start())) {
			intervals.set(intervals.size() - 1, new Interval(intervals.getLast().start(), next.end()));
		} else {
			intervals.add(next);
		}
	}

	private static void appendOnAir(List<Timeline.OnAir> onAir, Rule rule, Interval next) {
		if (!onAir.isEmpty()) {
			Timeline.OnAir last = onAir.getLast();
			if (last.rule() == rule && last.interval().end().equals(next.start())) {
				onAir.set(onAir.size() - 1, new Timeline.OnAir(rule, new Interval(last.interval().start(), next.end())));
				return;
			}
		}
		onAir.add(new Timeline.OnAir(rule, next));
	}

	private static LocalDateTime latest(LocalDateTime a, LocalDateTime b) {
		return a.isAfter(b) ? a : b;
	}

	private static LocalDateTime earliest(LocalDateTime a, LocalDateTime b) {
		return a.isBefore(b) ? a : b;
	}

}
