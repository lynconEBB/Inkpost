package online.techlyn.inkpost_api.schedule.dto;

import jakarta.validation.constraints.NotNull;
import online.techlyn.inkpost_api.schedule.model.MoveDirection;

public record MoveRuleRequest(@NotNull MoveDirection direction) {
}
