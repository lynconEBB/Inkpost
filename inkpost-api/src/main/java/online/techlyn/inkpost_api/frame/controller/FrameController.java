package online.techlyn.inkpost_api.frame.controller;

import static org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON_VALUE;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import online.techlyn.inkpost_api.frame.dto.FrameNameRequest;
import online.techlyn.inkpost_api.frame.dto.FrameResponse;
import online.techlyn.inkpost_api.frame.model.FrameImage;
import online.techlyn.inkpost_api.frame.service.FrameService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Frames", description = "The pictures the frame shows: 800×480, black and white")
@RestController
@RequestMapping("/api/frames")
public class FrameController {

	private static final String IMAGE_DESCRIPTION = "An 800×480 PNG where every pixel is opaque black (#000000) or "
			+ "white (#FFFFFF), at most 2 MB";

	private final FrameService frameService;

	public FrameController(FrameService frameService) {
		this.frameService = frameService;
	}

	@Operation(summary = "Upload a frame")
	@ApiResponse(responseCode = "201", description = "Created; Location is the new frame")
	@ApiResponse(responseCode = "400", description = "Invalid name or image",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "413", description = "Image larger than 2 MB",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public ResponseEntity<FrameResponse> create(
			@Parameter(description = "Not blank, at most 100 characters") @RequestPart @NotBlank @Size(max = 100) String name,
			@Parameter(description = IMAGE_DESCRIPTION) @RequestPart MultipartFile image) throws IOException {
		FrameResponse frame = frameService.create(name, image.getBytes());
		return ResponseEntity.created(URI.create("/api/frames/" + frame.id())).body(frame);
	}

	@Operation(summary = "List the frames", description = "Newest first.")
	@ApiResponse(responseCode = "200", description = "The frames")
	@GetMapping
	public List<FrameResponse> list() {
		return frameService.list();
	}

	@Operation(summary = "Get a frame")
	@ApiResponse(responseCode = "200", description = "The frame")
	@ApiResponse(responseCode = "404", description = "Unknown frame",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@GetMapping("/{id}")
	public FrameResponse get(@PathVariable int id) {
		return frameService.get(id);
	}

	@Operation(summary = "Get a frame's image",
			description = "An 800×480 1-bit PNG. The ETag is the one the device gets for the same pixels (D17); "
					+ "a matching If-None-Match is answered with 304.")
	@ApiResponse(responseCode = "200", description = "The image",
			content = @Content(mediaType = MediaType.IMAGE_PNG_VALUE, schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "304", description = "Not modified", content = @Content)
	@ApiResponse(responseCode = "404", description = "Unknown frame",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@GetMapping(value = "/{id}/image.png", produces = MediaType.IMAGE_PNG_VALUE)
	public ResponseEntity<byte[]> getImage(@PathVariable int id) {
		FrameImage png = frameService.getPng(id);
		// Spring answers 304 itself when If-None-Match matches the ETag.
		return ResponseEntity.ok()
				.eTag(png.etag())
				.cacheControl(CacheControl.noCache())
				.contentType(MediaType.IMAGE_PNG)
				.body(png.bytes());
	}

	@Operation(summary = "Rename a frame")
	@ApiResponse(responseCode = "200", description = "The renamed frame")
	@ApiResponse(responseCode = "400", description = "Invalid name",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "404", description = "Unknown frame",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@PatchMapping("/{id}")
	public FrameResponse rename(@PathVariable int id, @Valid @RequestBody FrameNameRequest request) {
		return frameService.rename(id, request.name());
	}

	@Operation(summary = "Replace a frame's image")
	@ApiResponse(responseCode = "200", description = "The frame")
	@ApiResponse(responseCode = "400", description = "Invalid image",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "404", description = "Unknown frame",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "413", description = "Image larger than 2 MB",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@PutMapping(value = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public FrameResponse replaceImage(@PathVariable int id,
			@Parameter(description = IMAGE_DESCRIPTION) @RequestPart MultipartFile image) throws IOException {
		return frameService.replaceImage(id, image.getBytes());
	}

	@Operation(summary = "Delete a frame", description = "A frame a rule uses can't be deleted (D27).")
	@ApiResponse(responseCode = "204", description = "Deleted")
	@ApiResponse(responseCode = "404", description = "Unknown frame",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "409", description = "A rule uses the frame; the detail names the rules",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable int id) {
		frameService.delete(id);
		return ResponseEntity.noContent().build();
	}

}
