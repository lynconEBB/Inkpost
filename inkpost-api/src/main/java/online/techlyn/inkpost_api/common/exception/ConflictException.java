package online.techlyn.inkpost_api.common.exception;

/** A request that conflicts with the current state, e.g. deleting a frame a rule uses: {@code 409} (D41). */
public class ConflictException extends RuntimeException {

	public ConflictException(String message) {
		super(message);
	}

}
