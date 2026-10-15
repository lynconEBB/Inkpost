package online.techlyn.inkpost_api.config;

import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	/** Boot's converters, including case-insensitive enums for request params ({@code ?pattern=border}). */
	@Override
	public void addFormatters(FormatterRegistry registry) {
		ApplicationConversionService.addApplicationConverters(registry);
	}

}
