package online.techlyn.inkpost_api.device.controller;

import static org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON_VALUE;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import online.techlyn.inkpost_api.config.OpenApiConfig;
import online.techlyn.inkpost_api.device.dto.DeviceStatusResponse;
import online.techlyn.inkpost_api.device.service.DeviceService;
import online.techlyn.inkpost_api.frame.model.FrameImage;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Device", description = "The frame's image (D9), and its last request for the web UI (D39)")
@RestController
public class DeviceController {

	private final DeviceService deviceService;

	public DeviceController(DeviceService deviceService) {
		this.deviceService = deviceService;
	}

	@Operation(summary = "Get the image to show now",
			description = "The frame's endpoint. Every call advances the winning rule's rotation (D38), even one "
					+ "answered with 304, so Swagger and curl calls show the next frame too.")
	@SecurityRequirement(name = OpenApiConfig.DEVICE_KEY)
	@ApiResponse(responseCode = "200", description = "The 48000 packed bytes (D4), with their ETag (D17)",
			content = @Content(mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE,
					schema = @Schema(type = "string", format = "binary")))
	@ApiResponse(responseCode = "304", description = "Same pixels as If-None-Match", content = @Content)
	@ApiResponse(responseCode = "401", description = "Missing or wrong device key", content = @Content)
	@ApiResponse(responseCode = "404", description = "Nothing to show: the default rule has no frames (D27)",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@GetMapping(value = "/api/image", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
	public ResponseEntity<byte[]> getImage() {
		FrameImage image = deviceService.nextImage();
		// Spring answers 304 itself when If-None-Match matches the ETag (W/ ignored, lists accepted).
		return ResponseEntity.ok()
				.eTag(image.etag())
				.cacheControl(CacheControl.noStore())
				.contentType(MediaType.APPLICATION_OCTET_STREAM)
				.body(image.bytes());
	}

	@Operation(summary = "Get the frame's last request",
			description = "For the \"now on the frame\" card. Offline after 3 h 15 min without a request.")
	@ApiResponse(responseCode = "200", description = "The last request")
	@GetMapping("/api/device")
	public DeviceStatusResponse getStatus() {
		return deviceService.status();
	}

}
