package online.techlyn.inkpost_api.config;

import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * The API's {@code 413} for a too large upload, in Problem Details (D41). Spring parses a multipart request
 * before it chooses a handler, so this error has none, and {@link ApiExceptionHandler}, which only handles
 * {@code @RestController}s, never sees it (D42). Only the API takes uploads.
 */
@RestControllerAdvice
public class UploadSizeExceptionHandler {

	@ExceptionHandler
	public ProblemDetail handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex) {
		return ex.getBody();
	}

}
