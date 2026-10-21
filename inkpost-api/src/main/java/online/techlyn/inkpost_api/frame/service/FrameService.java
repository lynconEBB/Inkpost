package online.techlyn.inkpost_api.frame.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.frame.dto.FrameResponse;
import online.techlyn.inkpost_api.frame.entity.Frame;
import online.techlyn.inkpost_api.frame.model.FrameImage;
import online.techlyn.inkpost_api.frame.repository.FrameRepository;
import online.techlyn.inkpost_api.frame.repository.FrameSummary;
import online.techlyn.inkpost_api.schedule.repository.RuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Frames are stored packed (D4); they never change the schedule version, the timeline only shows IDs. */
@Service
public class FrameService {

	private final FrameRepository frameRepository;
	private final RuleRepository ruleRepository;
	private final Clock clock;

	public FrameService(FrameRepository frameRepository, RuleRepository ruleRepository, Clock clock) {
		this.frameRepository = frameRepository;
		this.ruleRepository = ruleRepository;
		this.clock = clock;
	}

	@Transactional
	public FrameResponse create(String name, byte[] png) {
		byte[] bitmap = FrameImageCodec.decodePng(png);
		LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS);
		return toResponse(frameRepository.save(new Frame(name.strip(), bitmap, now)));
	}

	@Transactional(readOnly = true)
	public List<FrameResponse> list() {
		return frameRepository.findAllByOrderByCreatedAtDescIdDesc().stream().map(this::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public FrameResponse get(int id) {
		return toResponse(frameRepository.findSummaryById(id).orElseThrow(() -> notFound(id)));
	}

	@Transactional(readOnly = true)
	public FrameImage getPng(int id) {
		byte[] bitmap = find(id).getBitmap();
		return new FrameImage(FrameEtag.of(bitmap), FrameImageCodec.encodePng(bitmap));
	}

	@Transactional
	public FrameResponse rename(int id, String name) {
		Frame frame = find(id);
		frame.setName(name.strip());
		return toResponse(frame);
	}

	@Transactional
	public FrameResponse replaceImage(int id, byte[] png) {
		Frame frame = find(id);
		frame.setBitmap(FrameImageCodec.decodePng(png));
		return toResponse(frame);
	}

	/** A frame used by a rule can't be deleted (D27); the database refuses it too. */
	@Transactional
	public void delete(int id) {
		if (!frameRepository.existsById(id)) {
			throw notFound(id);
		}
		List<String> rules = ruleRepository.findNamesUsingFrame(id);
		if (!rules.isEmpty()) {
			String names = rules.stream().map(name -> "\"" + name + "\"").collect(Collectors.joining(", "));
			throw new ConflictException("Frame " + id + " is used by the rules " + names + "; remove it from them first");
		}
		frameRepository.deleteById(id);
	}

	private Frame find(int id) {
		return frameRepository.findById(id).orElseThrow(() -> notFound(id));
	}

	private static NotFoundException notFound(int id) {
		return new NotFoundException("Frame " + id + " not found");
	}

	private FrameResponse toResponse(Frame frame) {
		return toResponse(frame.getId(), frame.getName(), frame.getCreatedAt());
	}

	private FrameResponse toResponse(FrameSummary frame) {
		return toResponse(frame.getId(), frame.getName(), frame.getCreatedAt());
	}

	private FrameResponse toResponse(Integer id, String name, LocalDateTime createdAt) {
		return new FrameResponse(id, name, createdAt.atZone(clock.getZone()).toOffsetDateTime());
	}

}
