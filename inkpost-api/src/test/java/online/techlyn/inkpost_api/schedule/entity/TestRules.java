package online.techlyn.inkpost_api.schedule.entity;

import java.util.ArrayList;
import java.util.List;

/** Rules for tests: no window, and every hour, day, month and weekday until a test narrows them. */
public final class TestRules {

	public static final int ALL_HOURS = (1 << 24) - 1;
	public static final int ALL_DAYS_OF_MONTH = (int) ((1L << 31) - 1);
	public static final int ALL_MONTHS = (1 << 12) - 1;
	public static final int ALL_WEEKDAYS = (1 << 7) - 1;

	private TestRules() {
	}

	public static Rule rule(String name, int priority, Integer... frameIds) {
		Rule rule = new Rule();
		rule.setName(name);
		rule.setPriority(priority);
		rule.setHours(ALL_HOURS);
		rule.setDaysOfMonth(ALL_DAYS_OF_MONTH);
		rule.setMonths(ALL_MONTHS);
		rule.setWeekdays(ALL_WEEKDAYS);
		rule.setFrameIds(new ArrayList<>(List.of(frameIds)));
		return rule;
	}

}
