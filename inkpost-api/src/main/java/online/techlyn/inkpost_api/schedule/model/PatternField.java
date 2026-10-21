package online.techlyn.inkpost_api.schedule.model;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * The four fields of a rule's hour pattern (D38). Each is stored as a bitmask where bit
 * {@code value - min} is set when the value matches; the API speaks in lists of values (D41), and
 * this is the only place that converts between the two.
 */
public enum PatternField {

	HOURS(0, 23),
	DAYS_OF_MONTH(1, 31),
	MONTHS(1, 12),
	/** ISO: 1 = Monday … 7 = Sunday. */
	WEEKDAYS(1, 7);

	private final int min;
	private final int max;

	PatternField(int min, int max) {
		this.min = min;
		this.max = max;
	}

	/** The mask of every value. */
	public int all() {
		return (int) ((1L << (max - min + 1)) - 1);
	}

	/** Duplicates are ignored. */
	public int toMask(Collection<Integer> values) {
		int mask = 0;
		for (int value : values) {
			if (value < min || value > max) {
				throw new IllegalArgumentException(name() + " value " + value + " outside " + min + "-" + max);
			}
			mask |= 1 << (value - min);
		}
		return mask;
	}

	/** The values whose bits are set, ascending. */
	public List<Integer> toList(int mask) {
		List<Integer> values = new ArrayList<>();
		for (int value = min; value <= max; value++) {
			if (matches(mask, value)) {
				values.add(value);
			}
		}
		return values;
	}

	public boolean matches(int mask, int value) {
		return (mask & (1 << (value - min))) != 0;
	}

}
