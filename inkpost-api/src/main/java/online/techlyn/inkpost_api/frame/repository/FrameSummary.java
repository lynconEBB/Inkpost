package online.techlyn.inkpost_api.frame.repository;

import java.time.LocalDateTime;

/** A frame without its bitmap, so listing frames never loads 48 KB per frame. */
public interface FrameSummary {

	Integer getId();

	String getName();

	LocalDateTime getCreatedAt();

}
