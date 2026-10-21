package online.techlyn.inkpost_api.config;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Stores date-times as ISO-8601 text, e.g. {@code 2026-10-21T15:00:00}, truncated to seconds (D40).
 * The text reads well and compares correctly in SQL; sqlite-jdbc would otherwise store epoch millis.
 */
@Converter(autoApply = true)
public class LocalDateTimeTextConverter implements AttributeConverter<LocalDateTime, String> {

	private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss");

	@Override
	public String convertToDatabaseColumn(LocalDateTime value) {
		return value == null ? null : value.format(FORMAT);
	}

	@Override
	public LocalDateTime convertToEntityAttribute(String text) {
		return text == null ? null : LocalDateTime.parse(text, FORMAT);
	}

}
