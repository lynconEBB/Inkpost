package online.techlyn.inkpost_api.frame.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FrameNameRequest(@NotBlank @Size(max = 100) String name) {
}
