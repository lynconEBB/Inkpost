package online.techlyn.inkpost_api.schedule.controller;

import static org.springframework.http.MediaType.APPLICATION_PROBLEM_JSON_VALUE;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import online.techlyn.inkpost_api.schedule.dto.MoveRuleRequest;
import online.techlyn.inkpost_api.schedule.dto.RuleRequest;
import online.techlyn.inkpost_api.schedule.dto.RuleResponse;
import online.techlyn.inkpost_api.schedule.service.RuleService;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Rules", description = "The schedule (D38): prioritized rules, each an hour pattern inside an optional "
		+ "window, rotating its frames. The highest rule that covers an hour wins.")
@RestController
@RequestMapping("/api/rules")
public class RuleController {

	private final RuleService ruleService;

	public RuleController(RuleService ruleService) {
		this.ruleService = ruleService;
	}

	@Operation(summary = "List the rules", description = "Highest priority first, so the default rule is last.")
	@ApiResponse(responseCode = "200", description = "The rules")
	@GetMapping
	public List<RuleResponse> list() {
		return ruleService.list();
	}

	@Operation(summary = "Get a rule")
	@ApiResponse(responseCode = "200", description = "The rule")
	@ApiResponse(responseCode = "404", description = "Unknown rule",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@GetMapping("/{id}")
	public RuleResponse get(@PathVariable int id) {
		return ruleService.get(id);
	}

	@Operation(summary = "Create a rule", description = "The new rule goes on top.")
	@ApiResponse(responseCode = "201", description = "Created; Location is the new rule")
	@ApiResponse(responseCode = "400", description = "Invalid rule",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@PostMapping
	public ResponseEntity<RuleResponse> create(@Valid @RequestBody RuleRequest request) {
		RuleResponse rule = ruleService.create(request);
		return ResponseEntity.created(URI.create("/api/rules/" + rule.id())).body(rule);
	}

	@Operation(summary = "Replace a rule",
			description = "Keeps the priority and the rotation position. Of the default rule, only the name and the "
					+ "frames change, and its frames may be empty.")
	@ApiResponse(responseCode = "200", description = "The rule")
	@ApiResponse(responseCode = "400", description = "Invalid rule",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "404", description = "Unknown rule",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@PutMapping("/{id}")
	public RuleResponse update(@PathVariable int id, @Valid @RequestBody RuleRequest request) {
		return ruleService.update(id, request);
	}

	@Operation(summary = "Delete a rule")
	@ApiResponse(responseCode = "204", description = "Deleted")
	@ApiResponse(responseCode = "404", description = "Unknown rule",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "409", description = "The default rule can't be deleted",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable int id) {
		ruleService.delete(id);
		return ResponseEntity.noContent().build();
	}

	@Operation(summary = "Move a rule up or down", description = "Swaps its priority with the neighbour's.")
	@ApiResponse(responseCode = "200", description = "Every rule, in the new order")
	@ApiResponse(responseCode = "400", description = "Invalid direction",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "404", description = "Unknown rule",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@ApiResponse(responseCode = "409",
			description = "The default rule, up on the top rule, or down on the rule just above the default",
			content = @Content(mediaType = APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(implementation = ProblemDetail.class)))
	@PostMapping("/{id}/move")
	public List<RuleResponse> move(@PathVariable int id, @Valid @RequestBody MoveRuleRequest request) {
		return ruleService.move(id, request.direction());
	}

}
