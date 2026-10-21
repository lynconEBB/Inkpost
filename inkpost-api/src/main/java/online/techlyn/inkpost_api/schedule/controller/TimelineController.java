package online.techlyn.inkpost_api.schedule.controller;

import static org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON_VALUE;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDateTime;
import online.techlyn.inkpost_api.schedule.dto.TimelineResponse;
import online.techlyn.inkpost_api.schedule.service.TimelineService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Timeline", description = "What each rule covers and what is on air, for the timeline page (D39)")
@RestController
@RequestMapping("/api/timeline")
public class TimelineController {

	private final TimelineService timelineService;

	public TimelineController(TimelineService timelineService) {
		this.timelineService = timelineService;
	}

	@Operation(summary = "Get the timeline of a range",
			description = "One track per rule covering part of [from, to), highest priority first, and the winner of "
					+ "each hour. Intervals are [start, end), merged and clipped to the range. The version changes "
					+ "on every rule change.")
	@ApiResponse(responseCode = "200", description = "The timeline")
	@ApiResponse(responseCode = "400",
			description = "from or to missing or not whole hours, to not after from, or more than 62 days apart",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@GetMapping
	public TimelineResponse get(
			@Parameter(description = "Brasília local time, a whole hour", example = "2026-10-19T00:00:00")
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
			@Parameter(description = "Exclusive; a whole hour, at most 62 days after from", example = "2026-10-26T00:00:00")
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
		return timelineService.timeline(from, to);
	}

}
