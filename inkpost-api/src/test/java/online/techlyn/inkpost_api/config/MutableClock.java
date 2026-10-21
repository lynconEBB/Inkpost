package online.techlyn.inkpost_api.config;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** A clock tests set by hand, in Brasília time like the real one (D27). */
public class MutableClock extends Clock {

	public static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

	private Instant instant;

	public MutableClock(LocalDateTime now) {
		set(now);
	}

	public void set(LocalDateTime now) {
		instant = now.atZone(ZONE).toInstant();
	}

	@Override
	public ZoneId getZone() {
		return ZONE;
	}

	@Override
	public Clock withZone(ZoneId zone) {
		throw new UnsupportedOperationException("the app's clock is always in Brasília time");
	}

	@Override
	public Instant instant() {
		return instant;
	}

}
