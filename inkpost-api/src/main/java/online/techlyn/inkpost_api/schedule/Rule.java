package online.techlyn.inkpost_api.schedule;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Which frames to show and when (D38): an hour pattern, like cron without minutes, inside an
 * optional window. Each hour pattern field is a bitmask; all bits set means any value.
 * Times are Brasília local time (D27).
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Rule {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Setter(AccessLevel.NONE)
	private Integer id;

	@Column(nullable = false)
	private String name;

	/** The highest covering rule wins; the default rule is 0. */
	private int priority;

	/** The bottom rule that covers everything and can't be deleted. */
	private boolean isDefault;

	/** Null = no start. */
	private LocalDateTime startAt;

	/** Exclusive; null = no end. */
	private LocalDateTime endAt;

	/** Bit h = hour h (0–23). */
	private int hours;

	/** Bit d-1 = day d (1–31). */
	private int daysOfMonth;

	/** Bit m-1 = month m (1–12). */
	private int months;

	/** Bit 0 = Monday … bit 6 = Sunday (ISO). */
	private int weekdays;

	/** Position in {@link #frameIds} of the next frame to serve, taken modulo its size. */
	private int nextPosition;

	/** In rotation order. IDs rather than frames, so loading rules never loads the bitmaps. */
	@ElementCollection
	@CollectionTable(name = "rule_frame", joinColumns = @JoinColumn(name = "rule_id"))
	@OrderColumn(name = "position")
	@Column(name = "frame_id", nullable = false)
	private List<Integer> frameIds = new ArrayList<>();

}
