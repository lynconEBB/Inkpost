package online.techlyn.inkpost_api.device.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

/** The frame's last request, for the "now on the frame" card (D39). */
public record DeviceStatusResponse(
		@Schema(description = "Null before the first request")
		OffsetDateTime lastRequestAt,
		Integer ruleId,
		@Schema(description = "Null if the frame was deleted since")
		Integer frameId,
		@Schema(description = "Whether the last request was within 3 h 15 min: a wake every 3 hours, plus slack")
		boolean online) {
}
