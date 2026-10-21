package online.techlyn.inkpost_api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import online.techlyn.inkpost_api.config.MutableClock;
import online.techlyn.inkpost_api.config.TestClockConfig;
import online.techlyn.inkpost_api.frame.model.MonoBitmap;
import online.techlyn.inkpost_api.frame.service.FrameEtag;
import online.techlyn.inkpost_api.frame.service.TestPngs;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockPart;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * The whole path on a fresh in-memory database with a fixed clock: the web UI uploads a frame and puts
 * it in the default rule, the frame fetches it, and the web UI sees that request.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
class EndToEndTest {

	/** Whatever is configured: INKPOST_DEVICE_KEY, when set, wins over the tests' own key. */
	@Value("${inkpost.device-key}")
	private String deviceKey;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private MutableClock clock;

	@Test
	void theFrameShowsWhatTheWebUiScheduled() throws Exception {
		clock.set(LocalDateTime.of(2026, 10, 21, 15, 1));
		int frameId = upload("Praia", TestPngs.png(TestPngs.frame(0, 0, 799, 479)));
		int defaultRuleId = defaultRuleId();
		scheduleInTheDefaultRule(defaultRuleId, frameId);

		MonoBitmap expected = new MonoBitmap();
		expected.setBlack(0, 0);
		expected.setBlack(799, 479);
		String etag = FrameEtag.of(expected.toBytes());
		mockMvc.perform(get("/api/image").header("Authorization", "Bearer " + deviceKey))
				.andExpect(status().isOk())
				.andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM))
				.andExpect(header().string("ETag", etag))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(content().bytes(expected.toBytes()));

		clock.set(LocalDateTime.of(2026, 10, 21, 18, 1));
		mockMvc.perform(get("/api/image").header("Authorization", "Bearer " + deviceKey).header("If-None-Match", etag))
				.andExpect(status().isNotModified())
				.andExpect(header().string("ETag", etag))
				.andExpect(content().bytes(new byte[0]));

		mockMvc.perform(get("/api/device"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.lastRequestAt").value("2026-10-21T18:01:00-03:00"))
				.andExpect(jsonPath("$.ruleId").value(defaultRuleId))
				.andExpect(jsonPath("$.frameId").value(frameId))
				.andExpect(jsonPath("$.online").value(true));

		mockMvc.perform(get("/api/timeline").param("from", "2026-10-21T00:00:00").param("to", "2026-10-22T00:00:00"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rules.length()").value(1))
				.andExpect(jsonPath("$.rules[0].id").value(defaultRuleId))
				.andExpect(jsonPath("$.rules[0].isDefault").value(true))
				.andExpect(jsonPath("$.rules[0].frameIds", contains(frameId)))
				.andExpect(jsonPath("$.onAir.length()").value(1))
				.andExpect(jsonPath("$.onAir[0].start").value("2026-10-21T00:00:00-03:00"))
				.andExpect(jsonPath("$.onAir[0].end").value("2026-10-22T00:00:00-03:00"))
				.andExpect(jsonPath("$.onAir[0].ruleId").value(defaultRuleId));

		mockMvc.perform(get("/api/frames/" + frameId + "/image.png"))
				.andExpect(status().isOk())
				.andExpect(header().string("ETag", etag));
	}

	@Test
	void aNextFrameWithTheSamePixelsIs304AndTheRotationStillAdvances() throws Exception {
		clock.set(LocalDateTime.of(2026, 10, 22, 0, 1));
		byte[] png = TestPngs.png(TestPngs.frame(400, 240));
		int first = upload("Bolo", png);
		int second = upload("Bolo de novo", png);
		scheduleInTheDefaultRule(defaultRuleId(), first, second);

		String etag = mockMvc.perform(get("/api/image").header("Authorization", "Bearer " + deviceKey))
				.andExpect(status().isOk())
				.andReturn().getResponse().getHeader("ETag");
		int servedFirst = lastFrameId();

		clock.set(LocalDateTime.of(2026, 10, 22, 3, 1));
		mockMvc.perform(get("/api/image").header("Authorization", "Bearer " + deviceKey).header("If-None-Match", etag))
				.andExpect(status().isNotModified());

		assertThat(List.of(servedFirst, lastFrameId())).containsExactlyInAnyOrder(first, second);
		mockMvc.perform(get("/api/device")).andExpect(jsonPath("$.lastRequestAt").value("2026-10-22T03:01:00-03:00"));
	}

	private int upload(String name, byte[] png) throws Exception {
		return id(mockMvc.perform(multipart("/api/frames")
						.file(new MockMultipartFile("image", "frame.png", MediaType.IMAGE_PNG_VALUE, png))
						.part(new MockPart("name", name.getBytes(StandardCharsets.UTF_8))))
				.andExpect(status().isCreated()), "$.id");
	}

	private int defaultRuleId() throws Exception {
		List<Integer> ids = JsonPath.read(mockMvc.perform(get("/api/rules")).andReturn().getResponse()
				.getContentAsString(), "$[?(@.isDefault == true)].id");
		return ids.getFirst();
	}

	private void scheduleInTheDefaultRule(int defaultRuleId, int... frameIds) throws Exception {
		String ids = String.join(", ", Arrays.stream(frameIds).mapToObj(String::valueOf).toList());
		mockMvc.perform(put("/api/rules/" + defaultRuleId).contentType(MediaType.APPLICATION_JSON).content("""
						{ "name": "Padrão", "frameIds": [%s] }
						""".formatted(ids)))
				.andExpect(status().isOk());
	}

	private int lastFrameId() throws Exception {
		return id(mockMvc.perform(get("/api/device")), "$.frameId");
	}

	private static int id(ResultActions result, String path) throws Exception {
		return JsonPath.read(result.andReturn().getResponse().getContentAsString(), path);
	}

}
