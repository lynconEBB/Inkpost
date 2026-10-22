package online.techlyn.inkpost_api.device.controller;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.device.dto.DeviceStatusResponse;
import online.techlyn.inkpost_api.device.service.DeviceService;
import online.techlyn.inkpost_api.frame.model.FrameImage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(DeviceController.class)
class DeviceControllerTest {

	private static final byte[] BITMAP = {0x00, (byte) 0xFF, 0x0F};
	private static final String ETAG = "\"abc\"";

	/** Whatever is configured: INKPOST_DEVICE_KEY, when set, wins over the tests' own key. */
	@Value("${inkpost.device-key}")
	private String deviceKey;

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private DeviceService deviceService;

	@Test
	void withoutTheKeyIs401WithAnEmptyBody() throws Exception {
		mockMvc.perform(get("/api/image"))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string("WWW-Authenticate", "Bearer"))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(content().bytes(new byte[0]));
		verifyNoInteractions(deviceService);
	}

	@Test
	void aWrongKeyIs401() throws Exception {
		for (String authorization : new String[] {"Bearer wrong", "Bearer " + deviceKey + "2", deviceKey, "Bearer "}) {
			mockMvc.perform(get("/api/image").header("Authorization", authorization))
					.andExpect(status().isUnauthorized())
					.andExpect(content().bytes(new byte[0]));
		}
		verifyNoInteractions(deviceService);
	}

	@Test
	void returnsThePackedBytesWithTheirEtagNeverCached() throws Exception {
		when(deviceService.nextImage()).thenReturn(new FrameImage(ETAG, BITMAP));

		mockMvc.perform(image())
				.andExpect(status().isOk())
				.andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM))
				.andExpect(header().string("ETag", ETAG))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(content().bytes(BITMAP));
	}

	@Test
	void isNotModifiedWhenIfNoneMatchHasTheEtag() throws Exception {
		when(deviceService.nextImage()).thenReturn(new FrameImage(ETAG, BITMAP));

		for (String ifNoneMatch : new String[] {ETAG, "W/" + ETAG, "\"old\", W/" + ETAG, "\"old\"," + ETAG}) {
			mockMvc.perform(image().header("If-None-Match", ifNoneMatch))
					.andExpect(status().isNotModified())
					.andExpect(header().string("ETag", ETAG))
					.andExpect(header().string("Cache-Control", "no-store"))
					.andExpect(content().bytes(new byte[0]));
		}
	}

	@Test
	void aDifferentEtagGetsTheImage() throws Exception {
		when(deviceService.nextImage()).thenReturn(new FrameImage(ETAG, BITMAP));

		mockMvc.perform(image().header("If-None-Match", "\"old\", W/\"older\""))
				.andExpect(status().isOk())
				.andExpect(content().bytes(BITMAP));
	}

	@Test
	void theRotationAdvancesOnA304Too() throws Exception {
		when(deviceService.nextImage()).thenReturn(new FrameImage(ETAG, BITMAP));

		mockMvc.perform(image().header("If-None-Match", ETAG)).andExpect(status().isNotModified());

		verify(deviceService).nextImage();
	}

	@Test
	void nothingToShowIs404NeverCached() throws Exception {
		when(deviceService.nextImage()).thenThrow(new NotFoundException("Rule \"Default\" has no frames to show"));

		mockMvc.perform(image())
				.andExpect(status().isNotFound())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(header().string("Cache-Control", "no-store"));
	}

	@Test
	void theStatusIsForTheWebUiWithoutTheKey() throws Exception {
		when(deviceService.status()).thenReturn(
				new DeviceStatusResponse(OffsetDateTime.parse("2026-10-21T15:01:07-03:00"), 1, 7, true));

		mockMvc.perform(get("/api/device"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.lastRequestAt").value("2026-10-21T15:01:07-03:00"))
				.andExpect(jsonPath("$.ruleId").value(1))
				.andExpect(jsonPath("$.frameId").value(7))
				.andExpect(jsonPath("$.online").value(true));
	}

	@Test
	void aBlankKeyStopsTheApp() {
		assertThatThrownBy(() -> new DeviceKeyInterceptor(" ")).isInstanceOf(IllegalStateException.class);
	}

	private MockHttpServletRequestBuilder image() {
		return get("/api/image").header("Authorization", "Bearer " + deviceKey);
	}

}
