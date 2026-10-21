package online.techlyn.inkpost_api.config;

import java.time.LocalDateTime;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces the system clock with a {@link MutableClock}, starting at {@link #NOW}. */
@TestConfiguration
public class TestClockConfig {

	public static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 15, 0);

	@Bean
	@Primary
	public MutableClock testClock() {
		return new MutableClock(NOW);
	}

}
