package online.techlyn.inkpost_api.frame.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.config.MutableClock;
import online.techlyn.inkpost_api.config.TestClockConfig;
import online.techlyn.inkpost_api.frame.dto.FrameResponse;
import online.techlyn.inkpost_api.frame.entity.Frame;
import online.techlyn.inkpost_api.frame.model.MonoBitmap;
import online.techlyn.inkpost_api.schedule.entity.AppState;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.entity.TestRules;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({FrameService.class, TestClockConfig.class})
class FrameServiceTest {

	private static final byte[] WHITE_PNG = TestPngs.png(TestPngs.frame());

	@Autowired
	private FrameService frameService;

	@Autowired
	private TestEntityManager entityManager;

	@Autowired
	private MutableClock clock;

	@BeforeEach
	void resetClock() {
		clock.set(TestClockConfig.NOW);
	}

	@Test
	void createStoresThePackedPixelsAndTheTrimmedName() {
		FrameResponse frame = frameService.create("  Praia ", TestPngs.png(TestPngs.frame(0, 0)));
		entityManager.flush();
		entityManager.clear();

		assertThat(frame.name()).isEqualTo("Praia");
		assertThat(frame.createdAt()).isEqualTo(OffsetDateTime.parse("2026-10-21T15:00:00-03:00"));
		MonoBitmap expected = new MonoBitmap();
		expected.setBlack(0, 0);
		Frame saved = entityManager.find(Frame.class, frame.id());
		assertThat(saved.getName()).isEqualTo("Praia");
		assertThat(saved.getBitmap()).isEqualTo(expected.toBytes());
	}

	@Test
	void listsNewestFirst() {
		Integer beach = frameService.create("Praia", WHITE_PNG).id();
		clock.set(TestClockConfig.NOW.plusMinutes(1));
		Integer dinner = frameService.create("Jantar", WHITE_PNG).id();
		Integer cake = frameService.create("Bolo", WHITE_PNG).id();

		assertThat(frameService.list()).extracting(FrameResponse::id).containsExactly(cake, dinner, beach);
		assertThat(frameService.get(beach).name()).isEqualTo("Praia");
	}

	@Test
	void anUnknownFrameIsNotFound() {
		assertThatThrownBy(() -> frameService.get(99)).isInstanceOf(NotFoundException.class).hasMessage("Frame 99 not found");
		assertThatThrownBy(() -> frameService.getPng(99)).isInstanceOf(NotFoundException.class);
		assertThatThrownBy(() -> frameService.rename(99, "Praia")).isInstanceOf(NotFoundException.class);
		assertThatThrownBy(() -> frameService.replaceImage(99, WHITE_PNG)).isInstanceOf(NotFoundException.class);
		assertThatThrownBy(() -> frameService.delete(99)).isInstanceOf(NotFoundException.class);
	}

	@Test
	void renamesWithTheNameTrimmed() {
		Integer id = frameService.create("Praia", WHITE_PNG).id();

		assertThat(frameService.rename(id, " Praia de Copacabana ").name()).isEqualTo("Praia de Copacabana");
		assertThat(frameService.get(id).name()).isEqualTo("Praia de Copacabana");
	}

	@Test
	void replacingTheImageChangesTheEtagOfThePng() {
		Integer id = frameService.create("Praia", WHITE_PNG).id();
		String before = frameService.getPng(id).etag();

		frameService.replaceImage(id, TestPngs.png(TestPngs.frame(10, 10)));

		assertThat(frameService.getPng(id).etag()).isNotEqualTo(before);
		assertThat(frameService.getPng(id).etag()).isEqualTo(FrameEtag.of(entityManager.find(Frame.class, id).getBitmap()));
	}

	@Test
	void deletesAFrame() {
		Integer id = frameService.create("Praia", WHITE_PNG).id();

		frameService.delete(id);

		assertThatThrownBy(() -> frameService.get(id)).isInstanceOf(NotFoundException.class);
	}

	@Test
	void deletingAFrameARuleUsesIsAConflictNamingTheRules() {
		Integer id = frameService.create("Praia", WHITE_PNG).id();
		defaultRule().getFrameIds().add(id);
		entityManager.persist(TestRules.rule("Viagem", 1, id));
		entityManager.flush();

		assertThatThrownBy(() -> frameService.delete(id))
				.isInstanceOf(ConflictException.class)
				.hasMessage("Frame " + id + " is used by the rules \"Viagem\", \"Padrão\"; remove it from them first");
		assertThat(frameService.get(id).name()).isEqualTo("Praia");
	}

	@Test
	void frameChangesDoNotChangeTheScheduleVersion() {
		Integer id = frameService.create("Praia", WHITE_PNG).id();
		frameService.rename(id, "Jantar");
		frameService.replaceImage(id, TestPngs.png(TestPngs.frame(1, 1)));
		frameService.delete(id);
		entityManager.flush();
		entityManager.clear();

		assertThat(entityManager.find(AppState.class, AppState.ID).getScheduleVersion()).isZero();
	}

	private Rule defaultRule() {
		return entityManager.getEntityManager()
				.createQuery("select r from Rule r where r.isDefault = true", Rule.class)
				.getSingleResult();
	}

}
