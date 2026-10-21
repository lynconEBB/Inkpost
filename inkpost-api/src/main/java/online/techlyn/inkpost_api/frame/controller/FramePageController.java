package online.techlyn.inkpost_api.frame.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** The frames' pages (D42): Thymeleaf shells whose JS modules call the API. */
@Controller
public class FramePageController {

	@GetMapping("/frames")
	public String frames() {
		return "frames";
	}

	@GetMapping("/frames/new")
	public String upload() {
		return "frame-upload";
	}

}
