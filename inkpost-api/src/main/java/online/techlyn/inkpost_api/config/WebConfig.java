package online.techlyn.inkpost_api.config;

import online.techlyn.inkpost_api.device.controller.DeviceKeyInterceptor;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	private final DeviceKeyInterceptor deviceKeyInterceptor;

	public WebConfig(DeviceKeyInterceptor deviceKeyInterceptor) {
		this.deviceKeyInterceptor = deviceKeyInterceptor;
	}

	/** Boot's converters, including case-insensitive enums for request params ({@code ?pattern=border}). */
	@Override
	public void addFormatters(FormatterRegistry registry) {
		ApplicationConversionService.addApplicationConverters(registry);
	}

	/**
	 * {@code /api/image} is the frame's, protected by the device key; the rest of {@code /api/**} is behind
	 * Cloudflare Access (D41).
	 */
	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(deviceKeyInterceptor).addPathPatterns("/api/image");
	}

}
