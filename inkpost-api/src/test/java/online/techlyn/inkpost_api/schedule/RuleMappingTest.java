package online.techlyn.inkpost_api.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.persistence.PersistenceException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import online.techlyn.inkpost_api.display.MonoBitmap;
import online.techlyn.inkpost_api.frame.Frame;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RuleMappingTest {

	private static final int ALL_HOURS = (1 << 24) - 1;
	private static final int ALL_DAYS_OF_MONTH = (int) ((1L << 31) - 1);
	private static final int ALL_MONTHS = (1 << 12) - 1;
	private static final int ALL_WEEKDAYS = (1 << 7) - 1;

	@Autowired
	private TestEntityManager entityManager;

	@Test
	void theFirstMigrationCreatesTheDefaultRuleAndTheAppState() {
		List<Rule> rules = entityManager.getEntityManager()
				.createQuery("select r from Rule r", Rule.class)
				.getResultList();

		assertThat(rules).singleElement().satisfies(rule -> {
			assertThat(rule.isDefault()).isTrue();
			assertThat(rule.getPriority()).isZero();
			assertThat(rule.getStartAt()).isNull();
			assertThat(rule.getEndAt()).isNull();
			assertThat(rule.getHours()).isEqualTo(ALL_HOURS);
			assertThat(rule.getDaysOfMonth()).isEqualTo(ALL_DAYS_OF_MONTH);
			assertThat(rule.getMonths()).isEqualTo(ALL_MONTHS);
			assertThat(rule.getWeekdays()).isEqualTo(ALL_WEEKDAYS);
			assertThat(rule.getFrameIds()).isEmpty();
		});
		assertThat(entityManager.find(AppState.class, AppState.ID).getScheduleVersion()).isZero();
	}

	@Test
	void keepsTheWindowAndTheFramesInRotationOrder() {
		Integer beach = saveFrame("Praia");
		Integer dinner = saveFrame("Jantar");
		Rule trip = rule("Viagem", beach, dinner, beach);
		trip.setStartAt(LocalDateTime.of(2026, 11, 20, 0, 0));
		trip.setEndAt(LocalDateTime.of(2026, 11, 30, 0, 0));
		Integer id = entityManager.persistAndFlush(trip).getId();
		entityManager.clear();

		Rule saved = entityManager.find(Rule.class, id);

		assertThat(saved.getStartAt()).isEqualTo(LocalDateTime.of(2026, 11, 20, 0, 0));
		assertThat(saved.getEndAt()).isEqualTo(LocalDateTime.of(2026, 11, 30, 0, 0));
		assertThat(saved.getFrameIds()).containsExactly(beach, dinner, beach);
	}

	@Test
	void aFrameUsedByARuleCannotBeDeleted() {
		Integer beach = saveFrame("Praia");
		entityManager.persistAndFlush(rule("Fotos", beach));

		Frame frame = entityManager.find(Frame.class, beach);
		entityManager.remove(frame);

		assertThatThrownBy(entityManager::flush).isInstanceOf(PersistenceException.class);
	}

	@Test
	void rejectsAWindowThatEndsBeforeItStarts() {
		Rule rule = rule("Errada");
		rule.setStartAt(LocalDateTime.of(2026, 11, 30, 0, 0));
		rule.setEndAt(LocalDateTime.of(2026, 11, 20, 0, 0));

		assertThatThrownBy(() -> entityManager.persistAndFlush(rule)).isInstanceOf(PersistenceException.class);
	}

	private Integer saveFrame(String name) {
		return entityManager.persistAndFlush(
				new Frame(name, new MonoBitmap().toBytes(), LocalDateTime.of(2026, 10, 21, 15, 0))).getId();
	}

	private static Rule rule(String name, Integer... frameIds) {
		Rule rule = new Rule();
		rule.setName(name);
		rule.setPriority(1);
		rule.setHours(ALL_HOURS);
		rule.setDaysOfMonth(ALL_DAYS_OF_MONTH);
		rule.setMonths(ALL_MONTHS);
		rule.setWeekdays(ALL_WEEKDAYS);
		rule.setFrameIds(new ArrayList<>(List.of(frameIds)));
		return rule;
	}

}
