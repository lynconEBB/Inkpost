package online.techlyn.inkpost_api.config;

import java.util.ArrayList;
import java.util.List;
import online.techlyn.inkpost_api.common.exception.ConflictException;
import online.techlyn.inkpost_api.common.exception.FieldError;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.common.exception.NotFoundException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import tools.jackson.core.JacksonException;

/**
 * Turns every error into RFC 9457 Problem Details (D41). The base class covers Spring's own exceptions
 * (e.g. {@code 413} for a too large upload). Every {@code 400} has an {@code errors} array of
 * {@code { field, message }}, whether it comes from Bean Validation, request binding or a service.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	@ExceptionHandler
	public ProblemDetail handleNotFound(NotFoundException ex) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
	}

	@ExceptionHandler
	public ProblemDetail handleConflict(ConflictException ex) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
	}

	@ExceptionHandler
	public ProblemDetail handleInvalidInput(InvalidInputException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
		problem.setProperty("errors", ex.getErrors());
		return problem;
	}

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
				.map(e -> new FieldError(e.getField(), e.getDefaultMessage()))
				.toList();
		return withErrors(super.handleMethodArgumentNotValid(ex, headers, status, request), errors);
	}

	@Override
	protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldError> errors = new ArrayList<>();
		for (ParameterValidationResult result : ex.getParameterValidationResults()) {
			if (result instanceof ParameterErrors bodyErrors) {
				bodyErrors.getFieldErrors().forEach(e -> errors.add(new FieldError(e.getField(), e.getDefaultMessage())));
			} else {
				String parameter = result.getMethodParameter().getParameterName();
				result.getResolvableErrors().forEach(e -> errors.add(new FieldError(parameter, e.getDefaultMessage())));
			}
		}
		return withErrors(super.handleHandlerMethodValidationException(ex, headers, status, request), errors);
	}

	@Override
	protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		List<FieldError> errors = List.of(new FieldError(ex.getPropertyName(), "invalid value '" + ex.getValue() + "'"));
		return withErrors(super.handleTypeMismatch(ex, headers, status, request), errors);
	}

	@Override
	protected ResponseEntity<Object> handleMissingServletRequestParameter(MissingServletRequestParameterException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldError> errors = List.of(new FieldError(ex.getParameterName(), "is required"));
		return withErrors(super.handleMissingServletRequestParameter(ex, headers, status, request), errors);
	}

	@Override
	protected ResponseEntity<Object> handleMissingServletRequestPart(MissingServletRequestPartException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldError> errors = List.of(new FieldError(ex.getRequestPartName(), "is required"));
		return withErrors(super.handleMissingServletRequestPart(ex, headers, status, request), errors);
	}

	/** Malformed JSON has no field; a value of the wrong type is named by its JSON path (e.g. {@code hours[2]}). */
	@Override
	protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		List<FieldError> errors = List.of();
		if (ex.getCause() instanceof JacksonException jackson && !jackson.getPath().isEmpty()) {
			errors = List.of(new FieldError(jsonPath(jackson.getPath()), jackson.getOriginalMessage()));
		}
		return withErrors(super.handleHttpMessageNotReadable(ex, headers, status, request), errors);
	}

	private static ResponseEntity<Object> withErrors(ResponseEntity<Object> response, List<FieldError> errors) {
		if (response != null && response.getBody() instanceof ProblemDetail problem) {
			problem.setProperty("errors", errors);
		}
		return response;
	}

	private static String jsonPath(List<JacksonException.Reference> path) {
		StringBuilder field = new StringBuilder();
		for (JacksonException.Reference reference : path) {
			if (reference.getPropertyName() != null) {
				if (!field.isEmpty()) {
					field.append('.');
				}
				field.append(reference.getPropertyName());
			} else if (reference.getIndex() >= 0) {
				field.append('[').append(reference.getIndex()).append(']');
			}
		}
		return field.toString();
	}

}
