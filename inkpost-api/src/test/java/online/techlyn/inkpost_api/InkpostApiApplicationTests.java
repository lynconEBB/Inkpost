package online.techlyn.inkpost_api;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class InkpostApiApplicationTests {

	@Autowired
	private Clock clock;

	@Test
	void contextLoads() {
	}

	@Test
	void theClockIsInBrasiliaTime() {
		assertThat(clock.getZone()).isEqualTo(ZoneId.of("America/Sao_Paulo"));
	}

}
