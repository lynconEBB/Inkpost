package online.techlyn.inkpost_api.schedule.service;

import static online.techlyn.inkpost_api.schedule.entity.TestRules.rule;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.FieldError;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.config.TestClockConfig;
import online.techlyn.inkpost_api.frame.entity.Frame;
import online.techlyn.inkpost_api.frame.model.MonoBitmap;
import online.techlyn.inkpost_api.schedule.dto.TimelineResponse;
import online.techlyn.inkpost_api.schedule.entity.Rule;
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
@Import({TimelineService.class, TestClockConfig.class})
class TimelineServiceTest {

	private static final LocalDateTime OCT_21 = LocalDateTime.of(2026, 10, 21, 0, 0);

	@Autowired
	private TimelineService timelineService;

	@Autowired
	private AppStateRepository appStateRepository;

	@Autowired
	private TestEntityManager entityManager;

	private Rule fallback;
	private Rule mornings;
	private Rule trip;
	private Rule hidden;

	/**
	 * The default rule; mornings (06:00-09:00) above it; a trip on top from 22 October 00:00 to 12:00;
	 * and a rule under the trip that only covers hours the trip wins.
	 */
	@BeforeEach
	void saveRules() {
		Integer beach = saveFrame("Praia");
		Integer dinner = saveFrame("Jantar");
		fallback = entityManager.getEntityManager()
				.createQuery("select r from Rule r where r.isDefault = true", Rule.class)
				.getSingleResult();
		fallback.getFrameIds().add(beach);
		mornings = rule("Manhãs", 1, dinner);
		mornings.setHours(PatternField.HOURS.toMask(List.of(6, 7, 8)));
		hidden = rule("Escondida", 2, beach);
		hidden.setStartAt(OCT_21.plusDays(1).withHour(3));
		hidden.setEndAt(OCT_21.plusDays(1).withHour(6));
		trip = rule("Viagem", 3, beach, dinner);
		trip.setStartAt(OCT_21.plusDays(1));
		trip.setEndAt(OCT_21.plusDays(1).withHour(12));
		entityManager.persist(mornings);
		entityManager.persist(hidden);
		entityManager.persist(trip);
		entityManager.flush();
	}

	@Test
	void showsWhatEachRuleCoversAndWhatIsOnAir() {
		appStateRepository.incrementScheduleVersion();

		TimelineResponse timeline = timelineService.timeline(OCT_21, OCT_21.plusDays(2));

		assertThat(timeline.version()).isEqualTo(1);
		assertThat(timeline.rules()).extracting(TimelineResponse.Track::id)
				.containsExactly(trip.getId(), hidden.getId(), mornings.getId(), fallback.getId());
		assertThat(timeline.rules().getFirst()).isEqualTo(new TimelineResponse.Track(trip.getId(), "Viagem", 3, false,
				trip.getFrameIds(), List.of(interval("2026-10-22T00:00", "2026-10-22T12:00"))));
		assertThat(timeline.rules().get(1).covers()).containsExactly(interval("2026-10-22T03:00", "2026-10-22T06:00"));
		assertThat(timeline.rules().get(2).covers()).containsExactly(
				interval("2026-10-21T06:00", "2026-10-21T09:00"),
				interval("2026-10-22T06:00", "2026-10-22T09:00"));
		assertThat(timeline.rules().get(3).isDefault()).isTrue();
		assertThat(timeline.rules().get(3).covers()).containsExactly(interval("2026-10-21T00:00", "2026-10-23T00:00"));
		assertThat(timeline.onAir()).containsExactly(
				onAir("2026-10-21T00:00", "2026-10-21T06:00", fallback),
				onAir("2026-10-21T06:00", "2026-10-21T09:00", mornings),
				onAir("2026-10-21T09:00", "2026-10-22T00:00", fallback),
				onAir("2026-10-22T00:00", "2026-10-22T12:00", trip),
				onAir("2026-10-22T12:00", "2026-10-23T00:00", fallback));
	}

	@Test
	void leavesOutRulesThatCoverNothingAndCutsIntervalsAtTheRange() {
		TimelineResponse timeline = timelineService.timeline(OCT_21.withHour(7), OCT_21.plusDays(1).withHour(1));

		assertThat(timeline.rules()).extracting(TimelineResponse.Track::id)
				.containsExactly(trip.getId(), mornings.getId(), fallback.getId());
		assertThat(timeline.rules().get(1).covers()).containsExactly(interval("2026-10-21T07:00", "2026-10-21T09:00"));
		assertThat(timeline.onAir()).containsExactly(
				onAir("2026-10-21T07:00", "2026-10-21T09:00", mornings),
				onAir("2026-10-21T09:00", "2026-10-22T00:00", fallback),
				onAir("2026-10-22T00:00", "2026-10-22T01:00", trip));
	}

	@Test
	void acceptsUpTo62Days() {
		assertThat(timelineService.timeline(OCT_21, OCT_21.plusDays(62)).onAir()).isNotEmpty();
	}

	@Test
	void rejectsABadRange() {
		assertInvalid(OCT_21.withMinute(30), OCT_21.plusDays(1), new FieldError("from", "must be a whole hour"));
		assertInvalid(OCT_21, OCT_21.plusDays(1).withSecond(1), new FieldError("to", "must be a whole hour"));
		assertInvalid(OCT_21, OCT_21, new FieldError("to", "must be after from"));
		assertInvalid(OCT_21, OCT_21.minusHours(1), new FieldError("to", "must be after from"));
		assertInvalid(OCT_21, OCT_21.plusDays(62).plusHours(1), new FieldError("to", "must be at most 62 days after from"));
	}

	private void assertInvalid(LocalDateTime from, LocalDateTime to, FieldError error) {
		assertThatThrownBy(() -> timelineService.timeline(from, to))
				.isInstanceOfSatisfying(InvalidInputException.class, e -> assertThat(e.getErrors()).containsExactly(error));
	}

	private Integer saveFrame(String name) {
		return entityManager.persistAndFlush(new Frame(name, new MonoBitmap().toBytes(), OCT_21)).getId();
	}

	private static TimelineResponse.Interval interval(String start, String end) {
		return new TimelineResponse.Interval(brasilia(start), brasilia(end));
	}

	private static TimelineResponse.OnAir onAir(String start, String end, Rule rule) {
		return new TimelineResponse.OnAir(brasilia(start), brasilia(end), rule.getId());
	}

	private static OffsetDateTime brasilia(String localTime) {
		return OffsetDateTime.parse(localTime + ":00-03:00");
	}

}
