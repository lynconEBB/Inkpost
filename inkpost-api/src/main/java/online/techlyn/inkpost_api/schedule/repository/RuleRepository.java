package online.techlyn.inkpost_api.schedule.repository;

import java.util.List;
import online.techlyn.inkpost_api.schedule.entity.Rule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RuleRepository extends JpaRepository<Rule, Integer> {

	/** The default rule (priority 0) is last. */
	List<Rule> findAllByOrderByPriorityDesc();

	/** Never null: the default rule always exists. */
	@Query("select max(r.priority) from Rule r")
	int findMaxPriority();

	/** The rules that show the frame, highest priority first. */
	@Query("select r.name from Rule r where :frameId member of r.frameIds order by r.priority desc")
	List<String> findNamesUsingFrame(int frameId);

}
