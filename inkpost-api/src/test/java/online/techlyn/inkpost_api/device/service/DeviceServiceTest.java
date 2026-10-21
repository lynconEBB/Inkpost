package online.techlyn.inkpost_api.device.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.config.MutableClock;
import online.techlyn.inkpost_api.config.TestClockConfig;
import online.techlyn.inkpost_api.device.dto.DeviceStatusResponse;
import online.techlyn.inkpost_api.frame.entity.Frame;
import online.techlyn.inkpost_api.frame.model.FrameImage;
import online.techlyn.inkpost_api.frame.model.MonoBitmap;
import online.techlyn.inkpost_api.frame.service.FrameEtag;
import online.techlyn.inkpost_api.schedule.entity.AppState;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.entity.TestRules;
import online.techlyn.inkpost_api.schedule.model.PatternField;
import online.techlyn.inkpost_api.schedule.repository.AppStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({DeviceService.class, TestClockConfig.class})
class DeviceServiceTest {

	private static final LocalDateTime NOW = TestClockConfig.NOW;

	@Autowired
	private DeviceService deviceService;

	@Autowired
	private AppStateRepository appStateRepository;

	@Autowired
	private TestEntityManager entityManager;

	@Autowired
	private MutableClock clock;

	private Rule fallback;
	private Integer beach;
	private Integer dinner;
	private Integer cake;

	@BeforeEach
	void setUp() {
		clock.set(NOW);
		fallback = entityManager.getEntityManager()
				.createQuery("select r from Rule r where r.isDefault = true", Rule.class)
				.getSingleResult();
		beach = saveFrame("Praia", 0);
		dinner = saveFrame("Jantar", 1);
		cake = saveFrame("Bolo", 2);
	}

	@Test
	void anEmptyDefaultRuleIsNothingToShow() {
		assertThatThrownBy(deviceService::nextImage)
				.isInstanceOf(NotFoundException.class)
				.hasMessage("Rule \"Padrão\" has no frames to show");
		assertThat(deviceService.status().lastRequestAt()).isNull();
	}

	@Test
	void servesThePackedBytesWithTheirEtag() {
		fallback.setFrameIds(new ArrayList<>(List.of(dinner)));

		FrameImage image = deviceService.nextImage();

		byte[] bitmap = entityManager.find(Frame.class, dinner).getBitmap();
		assertThat(image.bytes()).hasSize(MonoBitmap.SIZE_BYTES).isEqualTo(bitmap);
		assertThat(image.etag()).isEqualTo(FrameEtag.of(bitmap));
	}

	@Test
	void theRotationAdvancesOnEveryRequestAndWraps() {
		fallback.setFrameIds(new ArrayList<>(List.of(beach, dinner, cake)));

		assertThat(servedFrames(4)).containsExactly(beach, dinner, cake, beach);
		assertThat(fallback.getNextPosition()).isEqualTo(1);
	}

	@Test
	void aHigherRulePausesTheRotationBelowIt() {
		fallback.setFrameIds(new ArrayList<>(List.of(beach, dinner)));
		Rule evenings = TestRules.rule("Noites", 1, cake);
		evenings.setHours(PatternField.HOURS.toMask(List.of(18, 19, 20)));
		entityManager.persist(evenings);

		assertThat(servedFrames(1)).containsExactly(beach);
		clock.set(NOW.withHour(18).withMinute(1));
		assertThat(servedFrames(2)).containsExactly(cake, cake);
		clock.set(NOW.withHour(21).withMinute(1));
		assertThat(servedFrames(1)).containsExactly(dinner);
	}

	@Test
	void takesThePositionModuloTheNumberOfFrames() {
		fallback.setFrameIds(new ArrayList<>(List.of(beach, dinner)));
		fallback.setNextPosition(5);

		assertThat(servedFrames(2)).containsExactly(dinner, beach);
	}

	@Test
	void recordsTheRequest() {
		fallback.setFrameIds(new ArrayList<>(List.of(beach)));
		clock.set(NOW.withMinute(1).withSecond(7));

		deviceService.nextImage();
		entityManager.flush();
		entityManager.clear();

		AppState state = entityManager.find(AppState.class, AppState.ID);
		assertThat(state.getLastRequestAt()).isEqualTo(NOW.withMinute(1).withSecond(7));
		assertThat(state.getLastRuleId()).isEqualTo(fallback.getId());
		assertThat(state.getLastFrameId()).isEqualTo(beach);
		assertThat(deviceService.status()).isEqualTo(new DeviceStatusResponse(
				OffsetDateTime.parse("2026-10-21T15:01:07-03:00"), fallback.getId(), beach, true));
		assertThat(appStateRepository.findScheduleVersion()).as("device requests don't change the schedule").isZero();
	}

	@Test
	void beforeTheFirstRequestTheFrameIsOffline() {
		assertThat(deviceService.status()).isEqualTo(new DeviceStatusResponse(null, null, null, false));
	}

	@Test
	void isOnlineUntil3h15mAfterTheLastRequest() {
		fallback.setFrameIds(new ArrayList<>(List.of(beach)));
		deviceService.nextImage();

		clock.set(NOW.plusHours(3).plusMinutes(14).plusSeconds(59));
		assertThat(deviceService.status().online()).isTrue();
		clock.set(NOW.plusHours(3).plusMinutes(15));
		assertThat(deviceService.status().online()).isTrue();
		clock.set(NOW.plusHours(3).plusMinutes(15).plusSeconds(1));
		assertThat(deviceService.status().online()).isFalse();
	}

	@Test
	void theFrameIsNullOnceDeleted() {
		fallback.setFrameIds(new ArrayList<>(List.of(beach)));
		deviceService.nextImage();
		fallback.setFrameIds(new ArrayList<>(List.of(dinner)));
		entityManager.remove(entityManager.find(Frame.class, beach));
		entityManager.flush();
		entityManager.clear();

		DeviceStatusResponse status = deviceService.status();

		assertThat(status.frameId()).isNull();
		assertThat(status.ruleId()).isEqualTo(fallback.getId());
	}

	private List<Integer> servedFrames(int requests) {
		List<Integer> frames = new ArrayList<>();
		for (int i = 0; i < requests; i++) {
			deviceService.nextImage();
			frames.add(entityManager.find(AppState.class, AppState.ID).getLastFrameId());
		}
		return frames;
	}

	/** Each frame gets a black pixel in its own column, so their bytes differ. */
	private Integer saveFrame(String name, int x) {
		MonoBitmap bitmap = new MonoBitmap();
		bitmap.setBlack(x, 0);
		return entityManager.persistAndFlush(new Frame(name, bitmap.toBytes(), NOW)).getId();
	}

}
