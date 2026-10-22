package online.techlyn.inkpost_api.schedule.controller;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SchedulePageController.class)
class SchedulePageControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void theScheduleIsTheHomePage() throws Exception {
		mockMvc.perform(get("/"))
				.andExpect(status().isOk())
				.andExpect(view().name("schedule"))
				.andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
				.andExpect(content().string(containsString("<script type=\"module\" src=\"/js/schedule.js\"></script>")))
				.andExpect(content().string(containsString("aria-current=\"page\">Schedule</a>")));
	}

	@Test
	void theNewRulePageHasNoRuleId() throws Exception {
		mockMvc.perform(get("/rules/new"))
				.andExpect(status().isOk())
				.andExpect(view().name("rule-form"))
				.andExpect(content().string(containsString("<script type=\"module\" src=\"/js/rule-form.js\"></script>")))
				.andExpect(content().string(not(containsString("data-rule-id"))));
	}

	@Test
	void theEditPageHandsTheRuleIdToItsScript() throws Exception {
		mockMvc.perform(get("/rules/7"))
				.andExpect(status().isOk())
				.andExpect(view().name("rule-form"))
				.andExpect(model().attribute("ruleId", 7))
				.andExpect(content().string(containsString("data-rule-id=\"7\"")))
				.andExpect(content().string(containsString("<script type=\"module\" src=\"/js/rule-form.js\"></script>")));
	}

}
