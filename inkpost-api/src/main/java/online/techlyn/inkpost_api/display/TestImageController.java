package online.techlyn.inkpost_api.display;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Display", description = "Images for the e-paper frame")
@RestController
@RequestMapping("/api/test-image")
public class TestImageController {

	private final TestImageService testImageService;

	public TestImageController(TestImageService testImageService) {
		this.testImageService = testImageService;
	}

	@Operation(
			summary = "Get a test image",
			description = "48000-byte 1bpp buffer for the Waveshare 7.5\" V2 (800×480). Row-major from the top-left, "
					+ "MSB = leftmost pixel, bit 1 = white, bit 0 = black.")
	@ApiResponse(responseCode = "200", description = "The packed image",
			content = @Content(mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE,
					schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "400", description = "Unknown pattern", content = @Content)
	@GetMapping(produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
	public ResponseEntity<byte[]> getTestImage(
			@Parameter(description = "Pattern to draw (case-insensitive)")
			@RequestParam(defaultValue = "checkerboard") TestPattern pattern) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.contentType(MediaType.APPLICATION_OCTET_STREAM)
				.body(testImageService.render(pattern));
	}

}
