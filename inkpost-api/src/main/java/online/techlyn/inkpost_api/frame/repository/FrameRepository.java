package online.techlyn.inkpost_api.frame.repository;

import java.util.List;
import java.util.Optional;
import online.techlyn.inkpost_api.frame.entity.Frame;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FrameRepository extends JpaRepository<Frame, Integer> {

	/** Newest first. */
	List<FrameSummary> findAllByOrderByCreatedAtDescIdDesc();

	Optional<FrameSummary> findSummaryById(Integer id);

}
