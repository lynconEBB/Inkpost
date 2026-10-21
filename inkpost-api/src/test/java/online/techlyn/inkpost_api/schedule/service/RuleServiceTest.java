package online.techlyn.inkpost_api.schedule.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.FieldError;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.config.TestClockConfig;
import online.techlyn.inkpost_api.frame.entity.Frame;
import online.techlyn.inkpost_api.frame.model.MonoBitmap;
import online.techlyn.inkpost_api.schedule.dto.RuleRequest;
import online.techlyn.inkpost_api.schedule.dto.RuleResponse;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.model.MoveDirection;
import online.techlyn.inkpost_api.schedule.repository.AppStateRepository;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({RuleService.class, TestClockConfig.class})
class RuleServiceTest {

	private static final LocalDateTime NOV_20 = LocalDateTime.of(2026, 11, 20, 0, 0);
	private static final LocalDateTime NOV_30 = LocalDateTime.of(2026, 11, 30, 0, 0);

	@Autowired
	private RuleService ruleService;

	@Autowired
	private AppStateRepository appStateRepository;

	@Autowired
	private TestEntityManager entityManager;

	private Integer beach;
	private Integer dinner;
	private int defaultId;

	@BeforeEach
	void saveFrames() {
		beach = saveFrame("Praia");
		dinner = saveFrame("Jantar");
		defaultId = ruleService.list().getLast().id();
	}

	@Test
	void createsARuleFromLists() {
		RuleResponse trip = ruleService.create(request("  Viagem ").window(NOV_20, NOV_30)
				.hours(6, 7, 8, 18, 19, 20).daysOfMonth(13, 13).months(11).weekdays(5)
				.frames(beach, dinner, beach).build());
		entityManager.flush();
		entityManager.clear();

		assertThat(trip.name()).isEqualTo("Viagem");
		assertThat(trip.isDefault()).isFalse();
		assertThat(trip.startAt()).isEqualTo(OffsetDateTime.parse("2026-11-20T00:00:00-03:00"));
		assertThat(trip.endAt()).isEqualTo(OffsetDateTime.parse("2026-11-30T00:00:00-03:00"));
		assertThat(trip.hours()).containsExactly(6, 7, 8, 18, 19, 20);
		assertThat(trip.daysOfMonth()).containsExactly(13);
		assertThat(trip.months()).containsExactly(11);
		assertThat(trip.weekdays()).containsExactly(5);
		assertThat(trip.frameIds()).containsExactly(beach, dinner, beach);
		Rule saved = entityManager.find(Rule.class, trip.id());
		assertThat(saved.getHours()).isEqualTo(0b111 << 6 | 0b111 << 18);
		assertThat(saved.getDaysOfMonth()).isEqualTo(1 << 12);
		assertThat(saved.getMonths()).isEqualTo(1 << 10);
		assertThat(saved.getWeekdays()).isEqualTo(1 << 4);
		assertThat(ruleService.get(trip.id())).isEqualTo(trip);
	}

	@Test
	void missingListsMeanEveryValueAndAreListedInFull() {
		RuleResponse rule = ruleService.create(request("Sempre").frames(beach).build());

		assertThat(rule.startAt()).isNull();
		assertThat(rule.endAt()).isNull();
		assertThat(rule.hours()).hasSize(24);
		assertThat(rule.daysOfMonth()).hasSize(31);
		assertThat(rule.months()).hasSize(12);
		assertThat(rule.weekdays()).containsExactly(1, 2, 3, 4, 5, 6, 7);
	}

	@Test
	void aNewRuleGoesOnTop() {
		RuleResponse first = ruleService.create(request("Primeira").frames(beach).build());
		RuleResponse second = ruleService.create(request("Segunda").frames(beach).build());

		assertThat(first.priority()).isEqualTo(1);
		assertThat(second.priority()).isEqualTo(2);
		assertThat(ruleService.list()).extracting(RuleResponse::name, RuleResponse::priority)
				.containsExactly(tuple("Segunda", 2), tuple("Primeira", 1), tuple("Padrão", 0));
	}

	@Test
	void theWindowMustBeOnThreeHourMarks() {
		assertInvalid(() -> ruleService.create(request("Viagem").window(NOV_20.withHour(14), null).frames(beach).build()),
				new FieldError("startAt", "must be on a 3-hour mark (00:00, 03:00, ..., 21:00)"));
		assertInvalid(() -> ruleService.create(request("Viagem").window(null, NOV_30.withMinute(30)).frames(beach).build()),
				new FieldError("endAt", "must be on a 3-hour mark (00:00, 03:00, ..., 21:00)"));
	}

	@Test
	void theWindowMustEndAfterItStarts() {
		assertInvalid(() -> ruleService.create(request("Viagem").window(NOV_20, NOV_20).frames(beach).build()),
				new FieldError("endAt", "must be after startAt"));
		assertInvalid(() -> ruleService.create(request("Viagem").window(NOV_30, NOV_20).frames(beach).build()),
				new FieldError("endAt", "must be after startAt"));
	}

	@Test
	void hoursMustBeWholeThreeHourBlocks() {
		assertInvalid(() -> ruleService.create(request("Manhã").hours(6, 7).frames(beach).build()),
				new FieldError("hours", "must be whole 3-hour blocks (0-2, 3-5, ..., 21-23)"));
		assertInvalid(() -> ruleService.create(request("Manhã").hours(5, 6, 7).frames(beach).build()),
				new FieldError("hours", "must be whole 3-hour blocks (0-2, 3-5, ..., 21-23)"));
	}

	@Test
	void aRuleNeedsAtLeastOneFrame() {
		assertInvalid(() -> ruleService.create(request("Vazia").frames().build()),
				new FieldError("frameIds", "must have at least one frame"));
	}

	@Test
	void everyFrameMustExist() {
		assertInvalid(() -> ruleService.create(request("Viagem").frames(beach, 99, 98, 99).build()),
				new FieldError("frameIds", "unknown frames: 99, 98"));
	}

	@Test
	void reportsEveryProblemAtOnceAndSavesNothing() {
		assertInvalid(() -> ruleService.create(request("Viagem").window(NOV_30, NOV_20.withHour(1)).hours(0).frames(99).build()),
				new FieldError("endAt", "must be on a 3-hour mark (00:00, 03:00, ..., 21:00)"),
				new FieldError("endAt", "must be after startAt"),
				new FieldError("hours", "must be whole 3-hour blocks (0-2, 3-5, ..., 21-23)"),
				new FieldError("frameIds", "unknown frames: 99"));
		assertThat(ruleService.list()).hasSize(1);
		assertThat(appStateRepository.findScheduleVersion()).isZero();
	}

	@Test
	void updateReplacesEverythingButThePriorityAndTheRotationPosition() {
		RuleResponse trip = ruleService.create(request("Viagem").window(NOV_20, NOV_30).weekdays(6, 7)
				.frames(beach, dinner).build());
		ruleService.create(request("Outra").frames(beach).build());
		entityManager.find(Rule.class, trip.id()).setNextPosition(1);

		RuleResponse updated = ruleService.update(trip.id(), request("Viagem longa").frames(dinner).build());
		entityManager.flush();
		entityManager.clear();

		assertThat(updated.name()).isEqualTo("Viagem longa");
		assertThat(updated.priority()).isEqualTo(trip.priority());
		assertThat(updated.startAt()).isNull();
		assertThat(updated.weekdays()).hasSize(7);
		assertThat(updated.frameIds()).containsExactly(dinner);
		assertThat(entityManager.find(Rule.class, trip.id()).getNextPosition()).isEqualTo(1);
	}

	@Test
	void anUnknownRuleIsNotFound() {
		RuleRequest request = request("Viagem").frames(beach).build();

		assertThatThrownBy(() -> ruleService.get(99)).isInstanceOf(NotFoundException.class).hasMessage("Rule 99 not found");
		assertThatThrownBy(() -> ruleService.update(99, request)).isInstanceOf(NotFoundException.class);
		assertThatThrownBy(() -> ruleService.delete(99)).isInstanceOf(NotFoundException.class);
		assertThatThrownBy(() -> ruleService.move(99, MoveDirection.UP)).isInstanceOf(NotFoundException.class);
	}

	@Test
	void theDefaultRuleTakesANameAndFramesEvenNone() {
		ruleService.update(defaultId, request("Fotos").frames(beach, dinner).build());

		RuleResponse emptied = ruleService.update(defaultId, request("Fotos").frames().build());

		assertThat(emptied.name()).isEqualTo("Fotos");
		assertThat(emptied.isDefault()).isTrue();
		assertThat(emptied.priority()).isZero();
		assertThat(emptied.frameIds()).isEmpty();
	}

	@Test
	void theDefaultRuleAcceptsEveryValueListedInFull() {
		RuleResponse rule = ruleService.update(defaultId, request("Padrão").weekdays(1, 2, 3, 4, 5, 6, 7)
				.months(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12).frames(beach).build());

		assertThat(rule.weekdays()).hasSize(7);
	}

	@Test
	void theDefaultRuleCoversEverything() {
		assertInvalid(() -> ruleService.update(defaultId, request("Padrão").window(NOV_20, NOV_30).frames(beach).build()),
				new FieldError("startAt", "must be empty: the default rule has no window"),
				new FieldError("endAt", "must be empty: the default rule has no window"));
		assertInvalid(() -> ruleService.update(defaultId, request("Padrão").hours(0, 1, 2).daysOfMonth(1).months(1)
						.weekdays(1).frames(beach).build()),
				new FieldError("hours", "must be every value: the default rule covers everything"),
				new FieldError("daysOfMonth", "must be every value: the default rule covers everything"),
				new FieldError("months", "must be every value: the default rule covers everything"),
				new FieldError("weekdays", "must be every value: the default rule covers everything"));
	}

	@Test
	void theDefaultRuleCannotBeDeleted() {
		assertThatThrownBy(() -> ruleService.delete(defaultId))
				.isInstanceOf(ConflictException.class)
				.hasMessage("The default rule can't be deleted");
	}

	@Test
	void deletingKeepsTheOrderAndANewRuleStillGoesOnTop() {
		Integer first = ruleService.create(request("Primeira").frames(beach).build()).id();
		Integer second = ruleService.create(request("Segunda").frames(beach).build()).id();
		Integer third = ruleService.create(request("Terceira").frames(beach).build()).id();

		ruleService.delete(second);
		Integer fourth = ruleService.create(request("Quarta").frames(beach).build()).id();

		assertThat(ruleService.list()).extracting(RuleResponse::id).containsExactly(fourth, third, first, defaultId);
		assertThat(ruleService.list()).extracting(RuleResponse::priority).containsExactly(4, 3, 1, 0);
	}

	@Test
	void movingSwapsThePriorityWithTheNeighbour() {
		Integer first = ruleService.create(request("Primeira").frames(beach).build()).id();
		Integer second = ruleService.create(request("Segunda").frames(beach).build()).id();
		Integer third = ruleService.create(request("Terceira").frames(beach).build()).id();

		List<RuleResponse> afterUp = ruleService.move(first, MoveDirection.UP);
		assertThat(afterUp).extracting(RuleResponse::id).containsExactly(third, first, second, defaultId);
		assertThat(afterUp).extracting(RuleResponse::priority).containsExactly(3, 2, 1, 0);

		List<RuleResponse> afterDown = ruleService.move(third, MoveDirection.DOWN);
		assertThat(afterDown).extracting(RuleResponse::id).containsExactly(first, third, second, defaultId);
		assertThat(ruleService.list()).isEqualTo(afterDown);
	}

	@Test
	void movingStopsAtTheTopAndAboveTheDefaultRule() {
		Integer bottom = ruleService.create(request("Baixo").frames(beach).build()).id();
		Integer top = ruleService.create(request("Cima").frames(beach).build()).id();

		assertThatThrownBy(() -> ruleService.move(top, MoveDirection.UP))
				.isInstanceOf(ConflictException.class)
				.hasMessage("Rule \"Cima\" is already the top rule");
		assertThatThrownBy(() -> ruleService.move(bottom, MoveDirection.DOWN))
				.isInstanceOf(ConflictException.class)
				.hasMessage("Rule \"Baixo\" is already just above the default rule");
		assertThatThrownBy(() -> ruleService.move(defaultId, MoveDirection.UP))
				.isInstanceOf(ConflictException.class)
				.hasMessage("The default rule can't be moved");
		assertThatThrownBy(() -> ruleService.move(defaultId, MoveDirection.DOWN)).isInstanceOf(ConflictException.class);
	}

	@Test
	void everyChangeIncrementsTheScheduleVersion() {
		Integer first = ruleService.create(request("Primeira").frames(beach).build()).id();
		assertThat(appStateRepository.findScheduleVersion()).isEqualTo(1);

		Integer second = ruleService.create(request("Segunda").frames(beach).build()).id();
		ruleService.update(first, request("Primeira").frames(dinner).build());
		assertThat(appStateRepository.findScheduleVersion()).isEqualTo(3);

		ruleService.move(first, MoveDirection.UP);
		assertThat(appStateRepository.findScheduleVersion()).isEqualTo(4);

		ruleService.delete(second);
		assertThat(appStateRepository.findScheduleVersion()).isEqualTo(5);

		ruleService.list();
		ruleService.get(first);
		assertThatThrownBy(() -> ruleService.move(first, MoveDirection.UP)).isInstanceOf(ConflictException.class);
		assertThat(appStateRepository.findScheduleVersion()).isEqualTo(5);
	}

	private Integer saveFrame(String name) {
		return entityManager.persistAndFlush(
				new Frame(name, new MonoBitmap().toBytes(), LocalDateTime.of(2026, 10, 21, 15, 0))).getId();
	}

	private static void assertInvalid(ThrowingCallable call, FieldError... errors) {
		assertThatThrownBy(call).isInstanceOfSatisfying(InvalidInputException.class,
				e -> assertThat(e.getErrors()).containsExactly(errors));
	}

	private static RequestBuilder request(String name) {
		return new RequestBuilder(name);
	}

	private static final class RequestBuilder {

		private final String name;
		private LocalDateTime startAt;
		private LocalDateTime endAt;
		private List<Integer> hours;
		private List<Integer> daysOfMonth;
		private List<Integer> months;
		private List<Integer> weekdays;
		private List<Integer> frameIds = new ArrayList<>();

		private RequestBuilder(String name) {
			this.name = name;
		}

		RequestBuilder window(LocalDateTime startAt, LocalDateTime endAt) {
			this.startAt = startAt;
			this.endAt = endAt;
			return this;
		}

		RequestBuilder hours(Integer... hours) {
			this.hours = Arrays.asList(hours);
			return this;
		}

		RequestBuilder daysOfMonth(Integer... daysOfMonth) {
			this.daysOfMonth = Arrays.asList(daysOfMonth);
			return this;
		}

		RequestBuilder months(Integer... months) {
			this.months = Arrays.asList(months);
			return this;
		}

		RequestBuilder weekdays(Integer... weekdays) {
			this.weekdays = Arrays.asList(weekdays);
			return this;
		}

		RequestBuilder frames(Integer... frameIds) {
			this.frameIds = Arrays.asList(frameIds);
			return this;
		}

		RuleRequest build() {
			return new RuleRequest(name, startAt, endAt, hours, daysOfMonth, months, weekdays, frameIds);
		}

	}

}
