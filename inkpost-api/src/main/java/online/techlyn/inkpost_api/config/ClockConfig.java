package online.techlyn.inkpost_api.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

	/** Every "now" comes from this clock, so tests can fix it. Its zone is Brasília (D27). */
	@Bean
	public Clock clock(@Value("${inkpost.timezone}") ZoneId timezone) {
		return Clock.system(timezone);
	}

}
