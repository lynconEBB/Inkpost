package online.techlyn.inkpost_api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class StaticFilesTest {

	@Autowired
	private MockMvc mockMvc;

	/** Cloudflare caches .js and .css by extension, and a deploy has to show up right away (D42). */
	@Test
	void theCssAndJsAreCheckedForANewVersionOnEveryLoad() throws Exception {
		mockMvc.perform(get("/css/app.css"))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-cache"));
		mockMvc.perform(get("/js/api.js"))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-cache"));
	}

}
