package online.techlyn.inkpost_api.schedule.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.FieldError;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import online.techlyn.inkpost_api.frame.repository.FrameRepository;
import online.techlyn.inkpost_api.schedule.dto.RuleRequest;
import online.techlyn.inkpost_api.schedule.dto.RuleResponse;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import online.techlyn.inkpost_api.schedule.model.MoveDirection;
import online.techlyn.inkpost_api.schedule.model.PatternField;
import online.techlyn.inkpost_api.schedule.repository.AppStateRepository;
import online.techlyn.inkpost_api.schedule.repository.RuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The schedule's rules (D38), in priority order. Every change increments the schedule version in the
 * same transaction (D39).
 */
@Service
public class RuleService {

	private final RuleRepository ruleRepository;
	private final FrameRepository frameRepository;
	private final AppStateRepository appStateRepository;
	private final Clock clock;

	public RuleService(RuleRepository ruleRepository, FrameRepository frameRepository,
			AppStateRepository appStateRepository, Clock clock) {
		this.ruleRepository = ruleRepository;
		this.frameRepository = frameRepository;
		this.appStateRepository = appStateRepository;
		this.clock = clock;
	}

	/** Highest priority first, so the default rule is last. */
	@Transactional(readOnly = true)
	public List<RuleResponse> list() {
		return ruleRepository.findAllByOrderByPriorityDesc().stream().map(this::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public RuleResponse get(int id) {
		return toResponse(find(id));
	}

	/** A new rule goes on top. */
	@Transactional
	public RuleResponse create(RuleRequest request) {
		Rule rule = new Rule();
		apply(request, rule);
		rule.setPriority(ruleRepository.findMaxPriority() + 1);
		ruleRepository.save(rule);
		appStateRepository.incrementScheduleVersion();
		return toResponse(rule);
	}

	/**
	 * Keeps the priority and the rotation position, which is taken modulo the new number of frames.
	 * Of the default rule, only the name and the frames change.
	 */
	@Transactional
	public RuleResponse update(int id, RuleRequest request) {
		Rule rule = find(id);
		apply(request, rule);
		appStateRepository.incrementScheduleVersion();
		return toResponse(rule);
	}

	@Transactional
	public void delete(int id) {
		Rule rule = find(id);
		if (rule.isDefault()) {
			throw new ConflictException("The default rule can't be deleted");
		}
		ruleRepository.delete(rule);
		appStateRepository.incrementScheduleVersion();
	}

	/**
	 * Swaps the priority with the neighbour above or below. The default rule stays at the bottom, so
	 * it can't move and nothing can move below it.
	 *
	 * @return every rule, in the new order
	 */
	@Transactional
	public List<RuleResponse> move(int id, MoveDirection direction) {
		List<Rule> rules = new ArrayList<>(ruleRepository.findAllByOrderByPriorityDesc());
		int index = indexOf(rules, id);
		Rule rule = rules.get(index);
		if (rule.isDefault()) {
			throw new ConflictException("The default rule can't be moved");
		}
		if (direction == MoveDirection.UP && index == 0) {
			throw new ConflictException("Rule \"" + rule.getName() + "\" is already the top rule");
		}
		int neighbourIndex = direction == MoveDirection.UP ? index - 1 : index + 1;
		Rule neighbour = rules.get(neighbourIndex);
		if (neighbour.isDefault()) {
			throw new ConflictException("Rule \"" + rule.getName() + "\" is already just above the default rule");
		}
		int priority = rule.getPriority();
		rule.setPriority(neighbour.getPriority());
		neighbour.setPriority(priority);
		Collections.swap(rules, index, neighbourIndex);
		appStateRepository.incrementScheduleVersion();
		return rules.stream().map(this::toResponse).toList();
	}

	private Rule find(int id) {
		return ruleRepository.findById(id).orElseThrow(() -> notFound(id));
	}

	private static int indexOf(List<Rule> rules, int id) {
		for (int i = 0; i < rules.size(); i++) {
			if (rules.get(i).getId() == id) {
				return i;
			}
		}
		throw notFound(id);
	}

	private static NotFoundException notFound(int id) {
		return new NotFoundException("Rule " + id + " not found");
	}

	/** Checks the domain rules (Bean Validation already checked the shapes), then copies the request. */
	private void apply(RuleRequest request, Rule rule) {
		int hours = toMask(PatternField.HOURS, request.hours());
		int daysOfMonth = toMask(PatternField.DAYS_OF_MONTH, request.daysOfMonth());
		int months = toMask(PatternField.MONTHS, request.months());
		int weekdays = toMask(PatternField.WEEKDAYS, request.weekdays());

		List<FieldError> errors = new ArrayList<>();
		if (rule.isDefault()) {
			checkDefaultRule(request, hours, daysOfMonth, months, weekdays, errors);
		} else {
			checkWindow(request.startAt(), request.endAt(), errors);
			if (!isWholeBlocks(hours)) {
				errors.add(new FieldError("hours", "must be whole 3-hour blocks (0-2, 3-5, ..., 21-23)"));
			}
			if (request.frameIds().isEmpty()) {
				errors.add(new FieldError("frameIds", "must have at least one frame"));
			}
		}
		List<Integer> unknownFrames = unknownFrames(request.frameIds());
		if (!unknownFrames.isEmpty()) {
			String ids = unknownFrames.stream().map(String::valueOf).collect(Collectors.joining(", "));
			errors.add(new FieldError("frameIds", "unknown frames: " + ids));
		}
		if (!errors.isEmpty()) {
			throw new InvalidInputException(errors);
		}

		rule.setName(request.name().strip());
		rule.setStartAt(request.startAt());
		rule.setEndAt(request.endAt());
		rule.setHours(hours);
		rule.setDaysOfMonth(daysOfMonth);
		rule.setMonths(months);
		rule.setWeekdays(weekdays);
		rule.setFrameIds(new ArrayList<>(request.frameIds()));
	}

	/** Null means every value. */
	private static int toMask(PatternField field, List<Integer> values) {
		return values == null ? field.all() : field.toMask(values);
	}

	/** The default rule covers everything (D38): no window, and every value of every field. */
	private static void checkDefaultRule(RuleRequest request, int hours, int daysOfMonth, int months, int weekdays,
			List<FieldError> errors) {
		String noWindow = "must be empty: the default rule has no window";
		String everyValue = "must be every value: the default rule covers everything";
		if (request.startAt() != null) {
			errors.add(new FieldError("startAt", noWindow));
		}
		if (request.endAt() != null) {
			errors.add(new FieldError("endAt", noWindow));
		}
		if (hours != PatternField.HOURS.all()) {
			errors.add(new FieldError("hours", everyValue));
		}
		if (daysOfMonth != PatternField.DAYS_OF_MONTH.all()) {
			errors.add(new FieldError("daysOfMonth", everyValue));
		}
		if (months != PatternField.MONTHS.all()) {
			errors.add(new FieldError("months", everyValue));
		}
		if (weekdays != PatternField.WEEKDAYS.all()) {
			errors.add(new FieldError("weekdays", everyValue));
		}
	}

	/** The frame only wakes at the 3-hour marks (D26). */
	private static void checkWindow(LocalDateTime startAt, LocalDateTime endAt, List<FieldError> errors) {
		String onAMark = "must be on a 3-hour mark (00:00, 03:00, ..., 21:00)";
		if (startAt != null && !isOnAMark(startAt)) {
			errors.add(new FieldError("startAt", onAMark));
		}
		if (endAt != null && !isOnAMark(endAt)) {
			errors.add(new FieldError("endAt", onAMark));
		}
		if (startAt != null && endAt != null && !endAt.isAfter(startAt)) {
			errors.add(new FieldError("endAt", "must be after startAt"));
		}
	}

	private static boolean isOnAMark(LocalDateTime time) {
		return time.getHour() % 3 == 0 && time.getMinute() == 0 && time.getSecond() == 0 && time.getNano() == 0;
	}

	/** Each block of hours 0-2, 3-5, ... is either all in or all out (D26, D38). */
	private static boolean isWholeBlocks(int hours) {
		for (int block = 0; block < 8; block++) {
			int bits = (hours >>> (block * 3)) & 0b111;
			if (bits != 0 && bits != 0b111) {
				return false;
			}
		}
		return true;
	}

	/** In request order, without repeats. */
	private List<Integer> unknownFrames(List<Integer> frameIds) {
		if (frameIds.isEmpty()) {
			return List.of();
		}
		Set<Integer> existing = frameRepository.findExistingIds(frameIds);
		return frameIds.stream().distinct().filter(id -> !existing.contains(id)).toList();
	}

	private RuleResponse toResponse(Rule rule) {
		return new RuleResponse(
				rule.getId(),
				rule.getName(),
				rule.getPriority(),
				rule.isDefault(),
				withOffset(rule.getStartAt()),
				withOffset(rule.getEndAt()),
				List.copyOf(rule.getFrameIds()),
				PatternField.HOURS.toList(rule.getHours()),
				PatternField.DAYS_OF_MONTH.toList(rule.getDaysOfMonth()),
				PatternField.MONTHS.toList(rule.getMonths()),
				PatternField.WEEKDAYS.toList(rule.getWeekdays()));
	}

	private OffsetDateTime withOffset(LocalDateTime time) {
		return time == null ? null : time.atZone(clock.getZone()).toOffsetDateTime();
	}

}
