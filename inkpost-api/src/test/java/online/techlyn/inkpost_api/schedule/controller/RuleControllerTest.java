package online.techlyn.inkpost_api.schedule.controller;

import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.schedule.dto.RuleRequest;
import online.techlyn.inkpost_api.schedule.dto.RuleResponse;
import online.techlyn.inkpost_api.schedule.model.MoveDirection;
import online.techlyn.inkpost_api.schedule.service.RuleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@WebMvcTest(RuleController.class)
class RuleControllerTest {

	private static final RuleResponse TRIP = new RuleResponse(7, "Viagem", 2, false,
			OffsetDateTime.parse("2026-11-20T00:00:00-03:00"), OffsetDateTime.parse("2026-11-30T00:00:00-03:00"),
			List.of(12, 15), List.of(6, 7, 8), List.of(13), List.of(11), List.of(5));
	private static final RuleResponse DEFAULT = new RuleResponse(1, "Padrão", 0, true, null, null,
			List.of(), List.of(0, 1, 2), List.of(1, 2), List.of(1), List.of(1, 2, 3, 4, 5, 6, 7));

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private RuleService ruleService;

	@Test
	void listsTheRulesWithEveryField() throws Exception {
		when(ruleService.list()).thenReturn(List.of(TRIP, DEFAULT));

		mockMvc.perform(get("/api/rules"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(7))
				.andExpect(jsonPath("$[0].name").value("Viagem"))
				.andExpect(jsonPath("$[0].priority").value(2))
				.andExpect(jsonPath("$[0].isDefault").value(false))
				.andExpect(jsonPath("$[0].startAt").value("2026-11-20T00:00:00-03:00"))
				.andExpect(jsonPath("$[0].endAt").value("2026-11-30T00:00:00-03:00"))
				.andExpect(jsonPath("$[0].frameIds", contains(12, 15)))
				.andExpect(jsonPath("$[0].hours", contains(6, 7, 8)))
				.andExpect(jsonPath("$[0].daysOfMonth", contains(13)))
				.andExpect(jsonPath("$[0].months", contains(11)))
				.andExpect(jsonPath("$[0].weekdays", contains(5)))
				.andExpect(jsonPath("$[1].isDefault").value(true))
				.andExpect(jsonPath("$[1].startAt").isEmpty());
	}

	@Test
	void anUnknownRuleIs404() throws Exception {
		when(ruleService.get(99)).thenThrow(new NotFoundException("Rule 99 not found"));

		mockMvc.perform(get("/api/rules/99"))
				.andExpect(status().isNotFound())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.detail").value("Rule 99 not found"));
	}

	@Test
	void createIs201WithTheLocationOfTheNewRule() throws Exception {
		when(ruleService.create(any())).thenReturn(TRIP);

		postRule("""
				{ "name": "Viagem", "startAt": "2026-11-20T00:00:00", "endAt": "2026-11-30T00:00:00",
				  "hours": [6, 7, 8], "weekdays": [5], "frameIds": [12, 15, 12] }
				""")
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", "/api/rules/7"))
				.andExpect(jsonPath("$.id").value(7));
		verify(ruleService).create(new RuleRequest("Viagem", LocalDateTime.of(2026, 11, 20, 0, 0),
				LocalDateTime.of(2026, 11, 30, 0, 0), List.of(6, 7, 8), null, null, List.of(5), List.of(12, 15, 12)));
	}

	@Test
	void aBlankNameIs400() throws Exception {
		postRule("""
				{ "name": " ", "frameIds": [1] }
				""")
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors[0].field").value("name"));
		verifyNoInteractions(ruleService);
	}

	@Test
	void anEmptyPatternListIs400() throws Exception {
		postRule("""
				{ "name": "Viagem", "weekdays": [], "frameIds": [1] }
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("weekdays"))
				.andExpect(jsonPath("$.errors[0].message").value("must not be empty; leave it out for every value"));
	}

	@Test
	void aPatternValueOutOfRangeIs400NamingIt() throws Exception {
		postRule("""
				{ "name": "Viagem", "hours": [21, 22, 24], "daysOfMonth": [0], "months": [13], "weekdays": [8],
				  "frameIds": [1] }
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.length()").value(4))
				.andExpect(jsonPath("$.errors[?(@.field == 'hours[2]')]").exists())
				.andExpect(jsonPath("$.errors[?(@.field == 'daysOfMonth[0]')]").exists())
				.andExpect(jsonPath("$.errors[?(@.field == 'months[0]')]").exists())
				.andExpect(jsonPath("$.errors[?(@.field == 'weekdays[0]')]").exists());
	}

	@Test
	void missingFramesAre400() throws Exception {
		postRule("""
				{ "name": "Viagem" }
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("frameIds"));
	}

	@Test
	void aDateTimeThatIsNotOneIs400() throws Exception {
		postRule("""
				{ "name": "Viagem", "startAt": "tomorrow", "frameIds": [1] }
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("startAt"));
	}

	@Test
	void aDomainRuleBrokenIs400WithTheServiceErrors() throws Exception {
		when(ruleService.create(any())).thenThrow(new InvalidInputException("frameIds", "unknown frames: 99"));

		postRule("""
				{ "name": "Viagem", "frameIds": [99] }
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("frameIds"))
				.andExpect(jsonPath("$.errors[0].message").value("unknown frames: 99"));
	}

	@Test
	void updateReturnsTheRule() throws Exception {
		when(ruleService.update(eq(7), any())).thenReturn(TRIP);

		mockMvc.perform(put("/api/rules/7").contentType(MediaType.APPLICATION_JSON).content("""
						{ "name": "Viagem", "frameIds": [12, 15] }
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Viagem"));
	}

	@Test
	void updatingAnUnknownRuleIs404() throws Exception {
		when(ruleService.update(anyInt(), any())).thenThrow(new NotFoundException("Rule 99 not found"));

		mockMvc.perform(put("/api/rules/99").contentType(MediaType.APPLICATION_JSON).content("""
						{ "name": "Viagem", "frameIds": [12] }
						"""))
				.andExpect(status().isNotFound());
	}

	@Test
	void deleteIs204() throws Exception {
		mockMvc.perform(delete("/api/rules/7"))
				.andExpect(status().isNoContent());
		verify(ruleService).delete(7);
	}

	@Test
	void deletingTheDefaultRuleIs409() throws Exception {
		doThrow(new ConflictException("The default rule can't be deleted")).when(ruleService).delete(1);

		mockMvc.perform(delete("/api/rules/1"))
				.andExpect(status().isConflict())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.detail").value("The default rule can't be deleted"));
	}

	@Test
	void moveReturnsTheRulesInTheNewOrder() throws Exception {
		when(ruleService.move(7, MoveDirection.DOWN)).thenReturn(List.of(TRIP, DEFAULT));

		move(7, """
				{ "direction": "DOWN" }
				""")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(7))
				.andExpect(jsonPath("$[1].id").value(1));
	}

	@Test
	void anUnknownDirectionIs400() throws Exception {
		move(7, """
				{ "direction": "LEFT" }
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("direction"));
		move(7, "{}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("direction"));
		verifyNoInteractions(ruleService);
	}

	@Test
	void aMoveThatCannotHappenIs409() throws Exception {
		when(ruleService.move(7, MoveDirection.UP)).thenThrow(new ConflictException("Rule \"Viagem\" is already the top rule"));

		move(7, """
				{ "direction": "UP" }
				""")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.detail").value("Rule \"Viagem\" is already the top rule"));
	}

	private ResultActions postRule(String json) throws Exception {
		return mockMvc.perform(post("/api/rules").contentType(MediaType.APPLICATION_JSON).content(json));
	}

	private ResultActions move(int id, String json) throws Exception {
		return mockMvc.perform(post("/api/rules/" + id + "/move").contentType(MediaType.APPLICATION_JSON).content(json));
	}

}
