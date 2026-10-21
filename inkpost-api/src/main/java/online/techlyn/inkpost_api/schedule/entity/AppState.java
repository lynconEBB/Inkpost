package online.techlyn.inkpost_api.schedule.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** App-wide state: a single row, created by the first migration. */
@Entity
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AppState {

	/** The ID of the only row. */
	public static final int ID = 1;

	@Id
	@Setter(AccessLevel.NONE)
	private Integer id;

	/** Incremented on every rule change, so the timeline page knows what it loaded is stale (D39). */
	private int scheduleVersion;

	/** The last device request, for the "now on the frame" card (D39); null until the first one. */
	private LocalDateTime lastRequestAt;

	private Integer lastRuleId;

	private Integer lastFrameId;

}
