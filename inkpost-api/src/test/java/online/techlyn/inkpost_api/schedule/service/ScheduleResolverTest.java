package online.techlyn.inkpost_api.schedule.service;

import static online.techlyn.inkpost_api.schedule.entity.TestRules.rule;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.List;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.model.Interval;
import online.techlyn.inkpost_api.schedule.model.PatternField;
import online.techlyn.inkpost_api.schedule.model.Timeline;
import org.junit.jupiter.api.Test;

class ScheduleResolverTest {

	private static final LocalDateTime FRIDAY_13 = LocalDateTime.of(2026, 11, 13, 6, 0);

	@Test
	void theDayOfTheMonthAndTheWeekdayMustBothMatch() {
		Rule friday13 = rule("Sexta-feira 13", 1);
		friday13.setDaysOfMonth(PatternField.DAYS_OF_MONTH.toMask(List.of(13)));
		friday13.setWeekdays(PatternField.WEEKDAYS.toMask(List.of(5)));

		assertThat(FRIDAY_13.getDayOfWeek()).isEqualTo(DayOfWeek.FRIDAY);
		assertThat(ScheduleResolver.covers(friday13, FRIDAY_13)).isTrue();
		assertThat(ScheduleResolver.covers(friday13, FRIDAY_13.minusWeeks(1))).as("another Friday").isFalse();
		assertThat(ScheduleResolver.covers(friday13, FRIDAY_13.plusMonths(1))).as("Sunday the 13th").isFalse();
	}

	@Test
	void theHourAndTheMonthMustMatch() {
		Rule mornings = rule("Manhãs de novembro", 1);
		mornings.setHours(PatternField.HOURS.toMask(List.of(6, 7, 8)));
		mornings.setMonths(PatternField.MONTHS.toMask(List.of(11)));

		assertThat(ScheduleResolver.covers(mornings, FRIDAY_13)).isTrue();
		assertThat(ScheduleResolver.covers(mornings, FRIDAY_13.withHour(8))).isTrue();
		assertThat(ScheduleResolver.covers(mornings, FRIDAY_13.withHour(9))).isFalse();
		assertThat(ScheduleResolver.covers(mornings, FRIDAY_13.withHour(5))).isFalse();
		assertThat(ScheduleResolver.covers(mornings, FRIDAY_13.withMonth(10))).isFalse();
	}

	@Test
	void day31NeverMatchesInAShorterMonth() {
		Rule day31 = rule("Dia 31", 1);
		day31.setDaysOfMonth(PatternField.DAYS_OF_MONTH.toMask(List.of(31)));

		assertThat(ScheduleResolver.covers(day31, LocalDateTime.of(2026, 10, 31, 0, 0))).isTrue();
		assertThat(ScheduleResolver.timeline(List.of(day31),
				LocalDateTime.of(2026, 11, 1, 0, 0), LocalDateTime.of(2026, 12, 1, 0, 0)).tracks()).isEmpty();
	}

	@Test
	void february29OnlyMatchesInLeapYears() {
		Rule leapDay = rule("29 de fevereiro", 1);
		leapDay.setDaysOfMonth(PatternField.DAYS_OF_MONTH.toMask(List.of(29)));
		leapDay.setMonths(PatternField.MONTHS.toMask(List.of(2)));

		assertThat(ScheduleResolver.timeline(List.of(leapDay),
				LocalDateTime.of(2027, 2, 1, 0, 0), LocalDateTime.of(2027, 3, 1, 0, 0)).tracks()).isEmpty();
		assertThat(ScheduleResolver.timeline(List.of(leapDay),
				LocalDateTime.of(2028, 2, 1, 0, 0), LocalDateTime.of(2028, 3, 1, 0, 0)).tracks())
				.singleElement()
				.extracting(Timeline.Track::covers)
				.isEqualTo(List.of(interval("2028-02-29T00:00", "2028-03-01T00:00")));
	}

	@Test
	void theWindowStartIsInclusiveAndItsEndExclusive() {
		Rule trip = rule("Viagem", 1);
		trip.setStartAt(LocalDateTime.of(2026, 11, 20, 0, 0));
		trip.setEndAt(LocalDateTime.of(2026, 11, 30, 0, 0));

		assertThat(ScheduleResolver.covers(trip, LocalDateTime.of(2026, 11, 19, 23, 0))).isFalse();
		assertThat(ScheduleResolver.covers(trip, LocalDateTime.of(2026, 11, 20, 0, 0))).isTrue();
		assertThat(ScheduleResolver.covers(trip, LocalDateTime.of(2026, 11, 29, 23, 0))).isTrue();
		assertThat(ScheduleResolver.covers(trip, LocalDateTime.of(2026, 11, 30, 0, 0))).isFalse();
	}

	@Test
	void aWindowCanBeOpenOnEitherSide() {
		Rule from = rule("A partir de", 1);
		from.setStartAt(LocalDateTime.of(2026, 11, 20, 0, 0));
		Rule until = rule("Até", 1);
		until.setEndAt(LocalDateTime.of(2026, 11, 20, 0, 0));

		assertThat(ScheduleResolver.covers(from, LocalDateTime.of(2099, 1, 1, 0, 0))).isTrue();
		assertThat(ScheduleResolver.covers(from, LocalDateTime.of(2026, 11, 19, 23, 0))).isFalse();
		assertThat(ScheduleResolver.covers(until, LocalDateTime.of(2000, 1, 1, 0, 0))).isTrue();
		assertThat(ScheduleResolver.covers(until, LocalDateTime.of(2026, 11, 20, 0, 0))).isFalse();
	}

	@Test
	void theHighestCoveringRuleWins() {
		Rule fallback = rule("Default", 0);
		Rule mornings = rule("Manhãs", 1);
		mornings.setHours(PatternField.HOURS.toMask(List.of(6, 7, 8)));
		Rule fridays = rule("Sextas", 2);
		fridays.setWeekdays(PatternField.WEEKDAYS.toMask(List.of(5)));
		List<Rule> rules = List.of(mornings, fallback, fridays);

		assertThat(ScheduleResolver.winner(rules, FRIDAY_13)).containsSame(fridays);
		assertThat(ScheduleResolver.winner(rules, FRIDAY_13.plusDays(1))).containsSame(mornings);
		assertThat(ScheduleResolver.winner(rules, FRIDAY_13.plusDays(1).withHour(12))).containsSame(fallback);
		assertThat(ScheduleResolver.winner(List.of(mornings), FRIDAY_13.withHour(12))).isEmpty();
	}

	@Test
	void mergesConsecutiveHoursAndShowsTheWinnerOfEachHour() {
		Rule fallback = rule("Default", 0);
		Rule mornings = rule("Manhãs", 1);
		mornings.setHours(PatternField.HOURS.toMask(List.of(6, 7, 8)));

		Timeline timeline = ScheduleResolver.timeline(List.of(fallback, mornings),
				LocalDateTime.of(2026, 10, 21, 0, 0), LocalDateTime.of(2026, 10, 23, 0, 0));

		assertThat(timeline.tracks()).extracting(Timeline.Track::rule).containsExactly(mornings, fallback);
		assertThat(timeline.tracks().get(0).covers()).containsExactly(
				interval("2026-10-21T06:00", "2026-10-21T09:00"),
				interval("2026-10-22T06:00", "2026-10-22T09:00"));
		assertThat(timeline.tracks().get(1).covers()).containsExactly(
				interval("2026-10-21T00:00", "2026-10-23T00:00"));
		assertThat(timeline.onAir()).containsExactly(
				new Timeline.OnAir(fallback, interval("2026-10-21T00:00", "2026-10-21T06:00")),
				new Timeline.OnAir(mornings, interval("2026-10-21T06:00", "2026-10-21T09:00")),
				new Timeline.OnAir(fallback, interval("2026-10-21T09:00", "2026-10-22T06:00")),
				new Timeline.OnAir(mornings, interval("2026-10-22T06:00", "2026-10-22T09:00")),
				new Timeline.OnAir(fallback, interval("2026-10-22T09:00", "2026-10-23T00:00")));
	}

	@Test
	void aRuleThatNeverWinsStillHasItsTrack() {
		Rule hidden = rule("Escondida", 1);
		hidden.setHours(PatternField.HOURS.toMask(List.of(6, 7, 8)));
		Rule everything = rule("Tudo", 2);

		Timeline timeline = ScheduleResolver.timeline(List.of(hidden, everything),
				LocalDateTime.of(2026, 10, 21, 0, 0), LocalDateTime.of(2026, 10, 22, 0, 0));

		assertThat(timeline.tracks()).extracting(Timeline.Track::rule).containsExactly(everything, hidden);
		assertThat(timeline.onAir()).containsExactly(
				new Timeline.OnAir(everything, interval("2026-10-21T00:00", "2026-10-22T00:00")));
	}

	@Test
	void clipsToTheRange() {
		Rule trip = rule("Viagem", 1);
		trip.setStartAt(LocalDateTime.of(2026, 10, 1, 0, 0));
		trip.setEndAt(LocalDateTime.of(2026, 10, 21, 12, 0));

		Timeline whole = ScheduleResolver.timeline(List.of(trip),
				LocalDateTime.of(2026, 10, 21, 0, 0), LocalDateTime.of(2026, 10, 22, 0, 0));
		Timeline partial = ScheduleResolver.timeline(List.of(trip),
				LocalDateTime.of(2026, 10, 21, 6, 30), LocalDateTime.of(2026, 10, 21, 9, 15));

		assertThat(whole.tracks().getFirst().covers()).containsExactly(interval("2026-10-21T00:00", "2026-10-21T12:00"));
		assertThat(whole.onAir()).containsExactly(
				new Timeline.OnAir(trip, interval("2026-10-21T00:00", "2026-10-21T12:00")));
		assertThat(partial.tracks().getFirst().covers()).containsExactly(interval("2026-10-21T06:30", "2026-10-21T09:15"));
	}

	@Test
	void anEmptyRangeHasNothing() {
		LocalDateTime now = LocalDateTime.of(2026, 10, 21, 0, 0);

		Timeline timeline = ScheduleResolver.timeline(List.of(rule("Default", 0)), now, now);

		assertThat(timeline.tracks()).isEmpty();
		assertThat(timeline.onAir()).isEmpty();
	}

	private static Interval interval(String start, String end) {
		return new Interval(LocalDateTime.parse(start), LocalDateTime.parse(end));
	}

}
