package online.techlyn.inkpost_api.common.exception;

/** One invalid input, in the {@code errors} array of a {@code 400} (D41). */
public record FieldError(String field, String message) {
}
