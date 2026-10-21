package online.techlyn.inkpost_api.schedule.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.FieldError;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.schedule.dto.TimelineResponse;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.model.Interval;
import online.techlyn.inkpost_api.schedule.model.Timeline;
import online.techlyn.inkpost_api.schedule.repository.AppStateRepository;
import online.techlyn.inkpost_api.schedule.repository.RuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The timeline page's data (D39), computed by the same {@link ScheduleResolver} the device uses. */
@Service
public class TimelineService {

	private static final int MAX_DAYS = 62;

	private final RuleRepository ruleRepository;
	private final AppStateRepository appStateRepository;
	private final Clock clock;

	public TimelineService(RuleRepository ruleRepository, AppStateRepository appStateRepository, Clock clock) {
		this.ruleRepository = ruleRepository;
		this.appStateRepository = appStateRepository;
		this.clock = clock;
	}

	/** The rules and the version are read in one transaction, so they always match. */
	@Transactional(readOnly = true)
	public TimelineResponse timeline(LocalDateTime from, LocalDateTime to) {
		checkRange(from, to);
		int version = appStateRepository.findScheduleVersion();
		Timeline timeline = ScheduleResolver.timeline(ruleRepository.findAll(), from, to);
		return new TimelineResponse(
				version,
				timeline.tracks().stream().map(this::toTrack).toList(),
				timeline.onAir().stream().map(this::toOnAir).toList());
	}

	private static void checkRange(LocalDateTime from, LocalDateTime to) {
		List<FieldError> errors = new ArrayList<>();
		if (!isWholeHour(from)) {
			errors.add(new FieldError("from", "must be a whole hour"));
		}
		if (!isWholeHour(to)) {
			errors.add(new FieldError("to", "must be a whole hour"));
		}
		if (!to.isAfter(from)) {
			errors.add(new FieldError("to", "must be after from"));
		} else if (to.isAfter(from.plusDays(MAX_DAYS))) {
			errors.add(new FieldError("to", "must be at most " + MAX_DAYS + " days after from"));
		}
		if (!errors.isEmpty()) {
			throw new InvalidInputException(errors);
		}
	}

	private static boolean isWholeHour(LocalDateTime time) {
		return time.getMinute() == 0 && time.getSecond() == 0 && time.getNano() == 0;
	}

	private TimelineResponse.Track toTrack(Timeline.Track track) {
		Rule rule = track.rule();
		return new TimelineResponse.Track(rule.getId(), rule.getName(), rule.getPriority(), rule.isDefault(),
				List.copyOf(rule.getFrameIds()), track.covers().stream().map(this::toInterval).toList());
	}

	private TimelineResponse.Interval toInterval(Interval interval) {
		return new TimelineResponse.Interval(withOffset(interval.start()), withOffset(interval.end()));
	}

	private TimelineResponse.OnAir toOnAir(Timeline.OnAir onAir) {
		Interval interval = onAir.interval();
		return new TimelineResponse.OnAir(withOffset(interval.start()), withOffset(interval.end()), onAir.rule().getId());
	}

	private OffsetDateTime withOffset(LocalDateTime time) {
		return time.atZone(clock.getZone()).toOffsetDateTime();
	}

}
