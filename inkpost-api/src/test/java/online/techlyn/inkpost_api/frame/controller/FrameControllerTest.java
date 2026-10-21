package online.techlyn.inkpost_api.frame.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.frame.dto.FrameResponse;
import online.techlyn.inkpost_api.frame.model.FrameImage;
import online.techlyn.inkpost_api.frame.service.FrameService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockPart;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FrameController.class)
class FrameControllerTest {

	private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G'};
	private static final FrameResponse BEACH =
			new FrameResponse(7, "Praia", OffsetDateTime.parse("2026-10-21T15:00:00-03:00"));

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private FrameService frameService;

	@Test
	void uploadIs201WithTheLocationOfTheNewFrame() throws Exception {
		when(frameService.create(eq("Praia"), any())).thenReturn(BEACH);

		mockMvc.perform(multipart("/api/frames").file(image()).part(namePart("Praia")))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", "/api/frames/7"))
				.andExpect(jsonPath("$.id").value(7))
				.andExpect(jsonPath("$.name").value("Praia"))
				.andExpect(jsonPath("$.createdAt").value("2026-10-21T15:00:00-03:00"));
		verify(frameService).create("Praia", PNG);
	}

	@Test
	void uploadWithABlankNameIs400() throws Exception {
		mockMvc.perform(multipart("/api/frames").file(image()).part(namePart("  ")))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors[0].field").value("name"));
		verifyNoInteractions(frameService);
	}

	@Test
	void uploadWithANameOver100CharactersIs400() throws Exception {
		mockMvc.perform(multipart("/api/frames").file(image()).part(namePart("a".repeat(101))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("name"));
	}

	@Test
	void uploadWithoutAnImageIs400() throws Exception {
		mockMvc.perform(multipart("/api/frames").part(namePart("Praia")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("image"))
				.andExpect(jsonPath("$.errors[0].message").value("is required"));
	}

	@Test
	void uploadOfAnInvalidImageIs400WithTheProblem() throws Exception {
		when(frameService.create(anyString(), any()))
				.thenThrow(new InvalidInputException("image", "pixel (12, 34) is #808080"));

		mockMvc.perform(multipart("/api/frames").file(image()).part(namePart("Praia")))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors[0].field").value("image"))
				.andExpect(jsonPath("$.errors[0].message").value("pixel (12, 34) is #808080"));
	}

	@Test
	void listsTheFrames() throws Exception {
		when(frameService.list()).thenReturn(List.of(BEACH));

		mockMvc.perform(get("/api/frames"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(7))
				.andExpect(jsonPath("$[0].name").value("Praia"));
	}

	@Test
	void anUnknownFrameIs404() throws Exception {
		when(frameService.get(99)).thenThrow(new NotFoundException("Frame 99 not found"));

		mockMvc.perform(get("/api/frames/99"))
				.andExpect(status().isNotFound())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.detail").value("Frame 99 not found"));
	}

	@Test
	void theImageIsAPngWithAnEtagThatMustBeRevalidated() throws Exception {
		when(frameService.getPng(7)).thenReturn(new FrameImage("\"abc\"", PNG));

		mockMvc.perform(get("/api/frames/7/image.png"))
				.andExpect(status().isOk())
				.andExpect(content().contentType(MediaType.IMAGE_PNG))
				.andExpect(header().string("ETag", "\"abc\""))
				.andExpect(header().string("Cache-Control", "no-cache"))
				.andExpect(content().bytes(PNG));
	}

	@Test
	void theImageIs304WhenTheEtagMatches() throws Exception {
		when(frameService.getPng(7)).thenReturn(new FrameImage("\"abc\"", PNG));

		mockMvc.perform(get("/api/frames/7/image.png").header("If-None-Match", "\"abc\""))
				.andExpect(status().isNotModified())
				.andExpect(header().string("ETag", "\"abc\""))
				.andExpect(content().bytes(new byte[0]));
		mockMvc.perform(get("/api/frames/7/image.png").header("If-None-Match", "\"other\""))
				.andExpect(status().isOk());
	}

	@Test
	void renames() throws Exception {
		when(frameService.rename(7, "Praia")).thenReturn(BEACH);

		mockMvc.perform(patch("/api/frames/7").contentType(MediaType.APPLICATION_JSON).content("""
						{ "name": "Praia" }
						"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Praia"));
	}

	@Test
	void renamingToABlankNameIs400() throws Exception {
		mockMvc.perform(patch("/api/frames/7").contentType(MediaType.APPLICATION_JSON).content("""
						{ "name": "" }
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("name"));
		verifyNoInteractions(frameService);
	}

	@Test
	void replacesTheImage() throws Exception {
		when(frameService.replaceImage(7, PNG)).thenReturn(BEACH);

		mockMvc.perform(multipart(HttpMethod.PUT, "/api/frames/7/image").file(image()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(7));
	}

	@Test
	void replacingTheImageOfAnUnknownFrameIs404() throws Exception {
		when(frameService.replaceImage(anyInt(), any())).thenThrow(new NotFoundException("Frame 99 not found"));

		mockMvc.perform(multipart(HttpMethod.PUT, "/api/frames/99/image").file(image()))
				.andExpect(status().isNotFound());
	}

	@Test
	void deleteIs204() throws Exception {
		mockMvc.perform(delete("/api/frames/7"))
				.andExpect(status().isNoContent());
		verify(frameService).delete(7);
	}

	@Test
	void deletingAFrameInUseIs409NamingTheRules() throws Exception {
		doThrow(new ConflictException("Frame 7 is used by the rules \"Viagem\"; remove it from them first"))
				.when(frameService).delete(7);

		mockMvc.perform(delete("/api/frames/7"))
				.andExpect(status().isConflict())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.detail").value("Frame 7 is used by the rules \"Viagem\"; remove it from them first"));
	}

	private static MockMultipartFile image() {
		return new MockMultipartFile("image", "frame.png", MediaType.IMAGE_PNG_VALUE, PNG);
	}

	private static MockPart namePart(String name) {
		return new MockPart("name", name.getBytes(StandardCharsets.UTF_8));
	}

}
