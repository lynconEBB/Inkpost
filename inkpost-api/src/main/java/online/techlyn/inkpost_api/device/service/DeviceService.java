package online.techlyn.inkpost_api.device.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.device.dto.DeviceStatusResponse;
import online.techlyn.inkpost_api.frame.model.FrameImage;
import online.techlyn.inkpost_api.frame.repository.FrameRepository;
import online.techlyn.inkpost_api.frame.service.FrameEtag;
import online.techlyn.inkpost_api.schedule.entity.AppState;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.repository.AppStateRepository;
import online.techlyn.inkpost_api.schedule.repository.RuleRepository;
import online.techlyn.inkpost_api.schedule.service.ScheduleResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** What the frame shows (D38), and its last request (D39). Never changes the schedule version. */
@Service
public class DeviceService {

	/** The frame wakes every 3 hours (D3); a bit of slack for a slow wake. */
	private static final Duration OFFLINE_AFTER = Duration.ofHours(3).plusMinutes(15);

	private final RuleRepository ruleRepository;
	private final FrameRepository frameRepository;
	private final AppStateRepository appStateRepository;
	private final Clock clock;

	public DeviceService(RuleRepository ruleRepository, FrameRepository frameRepository,
			AppStateRepository appStateRepository, Clock clock) {
		this.ruleRepository = ruleRepository;
		this.frameRepository = frameRepository;
		this.appStateRepository = appStateRepository;
		this.clock = clock;
	}

	/**
	 * The packed frame to show now: the winning rule's {@code frameIds[nextPosition % n]}, advancing its
	 * rotation and recording the request in the same transaction. This happens on every call, even one the
	 * device then gets a {@code 304} for: the request happened (D38).
	 *
	 * @throws NotFoundException when nothing covers now, or the winner (only ever the default rule) has no
	 *                           frames (D27)
	 */
	@Transactional
	public FrameImage nextImage() {
		LocalDateTime now = LocalDateTime.now(clock);
		LocalDateTime hour = now.truncatedTo(ChronoUnit.HOURS);
		Rule rule = ScheduleResolver.winner(ruleRepository.findAll(), hour)
				.orElseThrow(() -> new NotFoundException("No rule covers " + hour));
		List<Integer> frameIds = rule.getFrameIds();
		if (frameIds.isEmpty()) {
			throw new NotFoundException("Rule \"" + rule.getName() + "\" has no frames to show");
		}
		int position = rule.getNextPosition() % frameIds.size();
		Integer frameId = frameIds.get(position);
		rule.setNextPosition((position + 1) % frameIds.size());

		AppState state = appStateRepository.findById(AppState.ID).orElseThrow();
		state.setLastRequestAt(now);
		state.setLastRuleId(rule.getId());
		state.setLastFrameId(frameId);

		byte[] bitmap = frameRepository.findById(frameId).orElseThrow().getBitmap();
		return new FrameImage(FrameEtag.of(bitmap), bitmap);
	}

	@Transactional(readOnly = true)
	public DeviceStatusResponse status() {
		AppState state = appStateRepository.findById(AppState.ID).orElseThrow();
		LocalDateTime lastRequestAt = state.getLastRequestAt();
		if (lastRequestAt == null) {
			return new DeviceStatusResponse(null, null, null, false);
		}
		boolean online = !lastRequestAt.isBefore(LocalDateTime.now(clock).minus(OFFLINE_AFTER));
		return new DeviceStatusResponse(lastRequestAt.atZone(clock.getZone()).toOffsetDateTime(),
				state.getLastRuleId(), state.getLastFrameId(), online);
	}

}
