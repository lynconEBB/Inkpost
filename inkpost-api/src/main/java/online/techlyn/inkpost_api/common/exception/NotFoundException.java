package online.techlyn.inkpost_api.common.exception;

/** An unknown ID: answered with {@code 404} (D41). */
public class NotFoundException extends RuntimeException {

	public NotFoundException(String message) {
		super(message);
	}

}
