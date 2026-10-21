package online.techlyn.inkpost_api.frame.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import online.techlyn.inkpost_api.frame.entity.Frame;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface FrameRepository extends JpaRepository<Frame, Integer> {

	/** Newest first. */
	List<FrameSummary> findAllByOrderByCreatedAtDescIdDesc();

	Optional<FrameSummary> findSummaryById(Integer id);

	/** Which of the IDs exist, without loading the bitmaps. */
	@Query("select f.id from Frame f where f.id in :ids")
	Set<Integer> findExistingIds(Collection<Integer> ids);

}
