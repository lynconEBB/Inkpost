package online.techlyn.inkpost_api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class OpenApiDocsTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void documentsTheEndpoints() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/test-image']").exists())
				.andExpect(jsonPath("$.paths['/actuator/health']").exists())
				.andExpect(jsonPath("$.paths['/api/frames'].get").exists())
				.andExpect(jsonPath("$.paths['/api/frames'].post").exists())
				.andExpect(jsonPath("$.paths['/api/frames/{id}'].get").exists())
				.andExpect(jsonPath("$.paths['/api/frames/{id}'].patch").exists())
				.andExpect(jsonPath("$.paths['/api/frames/{id}'].delete").exists())
				.andExpect(jsonPath("$.paths['/api/frames/{id}/image.png'].get").exists())
				.andExpect(jsonPath("$.paths['/api/frames/{id}/image'].put").exists())
				.andExpect(jsonPath("$.paths['/api/rules'].get").exists())
				.andExpect(jsonPath("$.paths['/api/rules'].post").exists())
				.andExpect(jsonPath("$.paths['/api/rules/{id}'].get").exists())
				.andExpect(jsonPath("$.paths['/api/rules/{id}'].put").exists())
				.andExpect(jsonPath("$.paths['/api/rules/{id}'].delete").exists())
				.andExpect(jsonPath("$.paths['/api/rules/{id}/move'].post").exists())
				.andExpect(jsonPath("$.paths['/api/timeline'].get").exists());
	}

	@Test
	void theUploadIsAFormWithTheNameAndTheImage() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(jsonPath("$.paths['/api/frames'].post.requestBody.content['multipart/form-data']"
						+ ".schema.properties.name").exists())
				.andExpect(jsonPath("$.paths['/api/frames'].post.requestBody.content['multipart/form-data']"
						+ ".schema.properties.image.format").value("binary"));
	}

}
