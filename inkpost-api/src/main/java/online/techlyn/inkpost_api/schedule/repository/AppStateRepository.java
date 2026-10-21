package online.techlyn.inkpost_api.schedule.repository;

import online.techlyn.inkpost_api.schedule.entity.AppState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface AppStateRepository extends JpaRepository<AppState, Integer> {

	/** On every rule change, in its transaction, so the timeline page reloads (D39). */
	@Modifying
	@Query("update AppState s set s.scheduleVersion = s.scheduleVersion + 1")
	void incrementScheduleVersion();

	@Query("select s.scheduleVersion from AppState s")
	int findScheduleVersion();

}
