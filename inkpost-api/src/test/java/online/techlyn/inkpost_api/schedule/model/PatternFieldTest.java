package online.techlyn.inkpost_api.schedule.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import online.techlyn.inkpost_api.schedule.entity.TestRules;
import org.junit.jupiter.api.Test;

class PatternFieldTest {

	@Test
	void everyValueIsTheMaskTheMigrationStores() {
		assertThat(PatternField.HOURS.all()).isEqualTo(TestRules.ALL_HOURS).isEqualTo(16777215);
		assertThat(PatternField.DAYS_OF_MONTH.all()).isEqualTo(TestRules.ALL_DAYS_OF_MONTH).isEqualTo(2147483647);
		assertThat(PatternField.MONTHS.all()).isEqualTo(TestRules.ALL_MONTHS).isEqualTo(4095);
		assertThat(PatternField.WEEKDAYS.all()).isEqualTo(TestRules.ALL_WEEKDAYS).isEqualTo(127);
	}

	@Test
	void bitValueMinusMinIsSet() {
		assertThat(PatternField.HOURS.toMask(List.of(0, 23))).isEqualTo(1 | 1 << 23);
		assertThat(PatternField.DAYS_OF_MONTH.toMask(List.of(1, 31))).isEqualTo(1 | 1 << 30);
		assertThat(PatternField.MONTHS.toMask(List.of(12))).isEqualTo(1 << 11);
		assertThat(PatternField.WEEKDAYS.toMask(List.of(1))).as("Monday is bit 0").isEqualTo(1);
	}

	@Test
	void ignoresDuplicatesAndListsInAscendingOrder() {
		int mask = PatternField.WEEKDAYS.toMask(List.of(7, 6, 7));

		assertThat(PatternField.WEEKDAYS.toList(mask)).containsExactly(6, 7);
	}

	@Test
	void roundTripsEveryValue() {
		for (PatternField field : PatternField.values()) {
			List<Integer> every = field.toList(field.all());

			assertThat(field.toMask(every)).isEqualTo(field.all());
		}
		assertThat(PatternField.DAYS_OF_MONTH.toList(PatternField.DAYS_OF_MONTH.all())).hasSize(31).startsWith(1).endsWith(31);
		assertThat(PatternField.HOURS.toList(PatternField.HOURS.all())).hasSize(24).startsWith(0).endsWith(23);
	}

	@Test
	void matchesTheValuesWhoseBitsAreSet() {
		int mask = PatternField.MONTHS.toMask(List.of(2, 12));

		assertThat(PatternField.MONTHS.matches(mask, 2)).isTrue();
		assertThat(PatternField.MONTHS.matches(mask, 12)).isTrue();
		assertThat(PatternField.MONTHS.matches(mask, 1)).isFalse();
	}

	@Test
	void rejectsValuesOutOfRange() {
		assertThatThrownBy(() -> PatternField.HOURS.toMask(List.of(24))).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> PatternField.WEEKDAYS.toMask(List.of(0))).isInstanceOf(IllegalArgumentException.class);
	}

}
