package online.techlyn.inkpost_api.schedule.controller;

import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.schedule.dto.TimelineResponse;
import online.techlyn.inkpost_api.schedule.service.TimelineService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TimelineController.class)
class TimelineControllerTest {

	private static final OffsetDateTime START = OffsetDateTime.parse("2026-10-19T00:00:00-03:00");
	private static final OffsetDateTime END = OffsetDateTime.parse("2026-10-26T00:00:00-03:00");

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private TimelineService timelineService;

	@Test
	void returnsTheTimelineWithOffsets() throws Exception {
		when(timelineService.timeline(any(), any())).thenReturn(new TimelineResponse(42,
				List.of(new TimelineResponse.Track(1, "Padrão", 0, true, List.of(1, 2, 3),
						List.of(new TimelineResponse.Interval(START, END)))),
				List.of(new TimelineResponse.OnAir(START, END, 1))));

		mockMvc.perform(get("/api/timeline").param("from", "2026-10-19T00:00").param("to", "2026-10-26T00:00:00"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.version").value(42))
				.andExpect(jsonPath("$.rules[0].id").value(1))
				.andExpect(jsonPath("$.rules[0].priority").value(0))
				.andExpect(jsonPath("$.rules[0].isDefault").value(true))
				.andExpect(jsonPath("$.rules[0].frameIds", contains(1, 2, 3)))
				.andExpect(jsonPath("$.rules[0].covers[0].start").value("2026-10-19T00:00:00-03:00"))
				.andExpect(jsonPath("$.rules[0].covers[0].end").value("2026-10-26T00:00:00-03:00"))
				.andExpect(jsonPath("$.onAir[0].start").value("2026-10-19T00:00:00-03:00"))
				.andExpect(jsonPath("$.onAir[0].end").value("2026-10-26T00:00:00-03:00"))
				.andExpect(jsonPath("$.onAir[0].ruleId").value(1));
		verify(timelineService).timeline(LocalDateTime.of(2026, 10, 19, 0, 0), LocalDateTime.of(2026, 10, 26, 0, 0));
	}

	@Test
	void aMissingBoundIs400() throws Exception {
		mockMvc.perform(get("/api/timeline").param("to", "2026-10-26T00:00:00"))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors[0].field").value("from"));
		verifyNoInteractions(timelineService);
	}

	@Test
	void aBoundThatIsNotADateTimeIs400() throws Exception {
		mockMvc.perform(get("/api/timeline").param("from", "2026-10-19T00:00:00").param("to", "next week"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("to"));
	}

	@Test
	void aBadRangeIs400WithTheServiceErrors() throws Exception {
		when(timelineService.timeline(any(), any())).thenThrow(new InvalidInputException("to", "must be after from"));

		mockMvc.perform(get("/api/timeline").param("from", "2026-10-19T00:00:00").param("to", "2026-10-19T00:00:00"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("to"))
				.andExpect(jsonPath("$.errors[0].message").value("must be after from"));
	}

}
