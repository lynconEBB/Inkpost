package online.techlyn.inkpost_api.frame.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FramePageController.class)
class FramePageControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void theFramesPage() throws Exception {
		mockMvc.perform(get("/frames"))
				.andExpect(status().isOk())
				.andExpect(view().name("frames"))
				.andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
				.andExpect(content().string(containsString("<script type=\"module\" src=\"/js/frames.js\"></script>")))
				.andExpect(content().string(containsString("aria-current=\"page\">Frames</a>")));
	}

	@Test
	void theUploadPage() throws Exception {
		mockMvc.perform(get("/frames/new"))
				.andExpect(status().isOk())
				.andExpect(view().name("frame-upload"))
				.andExpect(content().string(containsString("<script type=\"module\" src=\"/js/upload.js\"></script>")));
	}

}
