package online.techlyn.inkpost_api.schedule.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/** The schedule's pages (D42): Thymeleaf shells whose JS modules call the API. */
@Controller
public class SchedulePageController {

	@GetMapping("/")
	public String schedule() {
		return "schedule";
	}

	@GetMapping("/rules/new")
	public String newRule() {
		return "rule-form";
	}

	/** The page loads the rule itself, and says so when it doesn't exist. */
	@GetMapping("/rules/{id}")
	public String editRule(@PathVariable int id, Model model) {
		model.addAttribute("ruleId", id);
		return "rule-form";
	}

}
