package online.techlyn.inkpost_api.frame.dto;

import java.time.OffsetDateTime;

public record FrameResponse(Integer id, String name, OffsetDateTime createdAt) {
}
