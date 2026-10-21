package online.techlyn.inkpost_api.frame;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.persistence.PersistenceException;
import java.time.LocalDateTime;
import online.techlyn.inkpost_api.display.MonoBitmap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class FrameMappingTest {

	@Autowired
	private TestEntityManager entityManager;

	@Test
	void readsBackWhatWasSaved() {
		MonoBitmap bitmap = new MonoBitmap();
		bitmap.setBlack(0, 0);
		Integer id = entityManager.persistAndFlush(
				new Frame("Praia", bitmap.toBytes(), LocalDateTime.of(2026, 10, 21, 15, 30, 12, 999_000_000))).getId();
		entityManager.clear();

		Frame frame = entityManager.find(Frame.class, id);

		assertThat(frame.getName()).isEqualTo("Praia");
		assertThat(frame.getBitmap()).isEqualTo(bitmap.toBytes());
		assertThat(frame.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 10, 21, 15, 30, 12));
	}

	@Test
	void rejectsABitmapOfTheWrongSize() {
		Frame frame = new Frame("Small", new byte[10], LocalDateTime.of(2026, 10, 21, 15, 0));

		assertThatThrownBy(() -> entityManager.persistAndFlush(frame)).isInstanceOf(PersistenceException.class);
	}

}
