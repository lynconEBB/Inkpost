package online.techlyn.inkpost_api.common.exception;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Input that breaks a domain rule: {@code 400}, with the same {@code errors} array as a Bean Validation
 * failure (D41).
 */
public class InvalidInputException extends RuntimeException {

	private final List<FieldError> errors;

	public InvalidInputException(List<FieldError> errors) {
		super(errors.stream().map(e -> e.field() + ": " + e.message()).collect(Collectors.joining("; ")));
		this.errors = List.copyOf(errors);
	}

	public InvalidInputException(String field, String message) {
		this(List.of(new FieldError(field, message)));
	}

	public List<FieldError> getErrors() {
		return errors;
	}

}
