package online.techlyn.inkpost_api.config;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.FieldError;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@WebMvcTest(ApiExceptionHandlerTest.ThrowingController.class)
@Import(ApiExceptionHandlerTest.ThrowingController.class)
class ApiExceptionHandlerTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void notFoundIs404() throws Exception {
		mockMvc.perform(get("/test/not-found"))
				.andExpect(status().isNotFound())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.detail").value("Frame 7 not found"));
	}

	@Test
	void conflictIs409() throws Exception {
		mockMvc.perform(get("/test/conflict"))
				.andExpect(status().isConflict())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.detail").value("Frame 7 is in use"));
	}

	@Test
	void invalidInputIs400WithTheFieldErrors() throws Exception {
		mockMvc.perform(get("/test/invalid"))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.errors.length()").value(2))
				.andExpect(jsonPath("$.errors[0].field").value("frameIds"))
				.andExpect(jsonPath("$.errors[0].message").value("unknown frames: 7, 9"))
				.andExpect(jsonPath("$.errors[1].field").value("startAt"))
				.andExpect(jsonPath("$.errors[1].message").value("must be on a 3-hour mark"));
	}

	@Test
	void aBeanValidationFailureIs400WithTheSameErrors() throws Exception {
		mockMvc.perform(post("/test/body").contentType(MediaType.APPLICATION_JSON).content("""
						{ "name": " ", "count": 1 }
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors.length()").value(1))
				.andExpect(jsonPath("$.errors[0].field").value("name"))
				.andExpect(jsonPath("$.errors[0].message").isNotEmpty());
	}

	@Test
	void aConstraintOnAParameterIs400() throws Exception {
		mockMvc.perform(get("/test/param").param("count", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("count"))
				.andExpect(jsonPath("$.errors[0].message").isNotEmpty());
	}

	@Test
	void aMissingParameterIs400() throws Exception {
		mockMvc.perform(get("/test/param"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("count"))
				.andExpect(jsonPath("$.errors[0].message").value("is required"));
	}

	@Test
	void aParameterOfTheWrongTypeIs400() throws Exception {
		mockMvc.perform(get("/test/param").param("count", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[0].field").value("count"))
				.andExpect(jsonPath("$.errors[0].message").value("invalid value 'abc'"));
	}

	@Test
	void aJsonValueOfTheWrongTypeIs400NamingTheField() throws Exception {
		mockMvc.perform(post("/test/body").contentType(MediaType.APPLICATION_JSON).content("""
						{ "name": "Praia", "count": "many" }
						"""))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors[0].field").value("count"))
				.andExpect(jsonPath("$.errors[0].message").value(containsString("many")));
	}

	@Test
	void malformedJsonIs400WithNoFieldErrors() throws Exception {
		mockMvc.perform(post("/test/body").contentType(MediaType.APPLICATION_JSON).content("{"))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors").value(empty()));
	}

	@Test
	void aTooLargeUploadIs413() throws Exception {
		mockMvc.perform(post("/test/upload"))
				.andExpect(status().isContentTooLarge())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(413));
	}

	@RestController
	@RequestMapping("/test")
	static class ThrowingController {

		@GetMapping("/not-found")
		void notFound() {
			throw new NotFoundException("Frame 7 not found");
		}

		@GetMapping("/conflict")
		void conflict() {
			throw new ConflictException("Frame 7 is in use");
		}

		@GetMapping("/invalid")
		void invalid() {
			throw new InvalidInputException(List.of(
					new FieldError("frameIds", "unknown frames: 7, 9"),
					new FieldError("startAt", "must be on a 3-hour mark")));
		}

		@PostMapping("/body")
		void body(@Valid @RequestBody Body body) {
		}

		@GetMapping("/param")
		void param(@RequestParam @Min(1) int count) {
		}

		@PostMapping("/upload")
		void upload() {
			throw new MaxUploadSizeExceededException(2 * 1024 * 1024);
		}

	}

	record Body(@NotBlank String name, int count) {
	}

}
