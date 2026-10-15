package online.techlyn.inkpost_api.display;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TestImageController.class)
class TestImageControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private TestImageService testImageService;

	@Test
	void returnsTheServiceBytesUncached() throws Exception {
		byte[] image = {1, 2, 3};
		when(testImageService.render(TestPattern.CHECKERBOARD)).thenReturn(image);

		mockMvc.perform(get("/api/test-image"))
				.andExpect(status().isOk())
				.andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(content().bytes(image));
	}

	@Test
	void acceptsLowercasePatternNames() throws Exception {
		when(testImageService.render(TestPattern.BORDER)).thenReturn(new byte[0]);

		mockMvc.perform(get("/api/test-image").param("pattern", "border"))
				.andExpect(status().isOk());

		verify(testImageService).render(TestPattern.BORDER);
	}

	@Test
	void rejectsUnknownPatterns() throws Exception {
		mockMvc.perform(get("/api/test-image").param("pattern", "nope"))
				.andExpect(status().isBadRequest());
	}

}
