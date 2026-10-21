package online.techlyn.inkpost_api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	/** The security scheme of the {@code /device/**} endpoints, so Swagger UI can send the key. */
	public static final String DEVICE_KEY = "deviceKey";

	@Bean
	public OpenAPI inkpostOpenApi() {
		return new OpenAPI()
				.info(new Info()
						.title("inkpost API")
						.version("0.1")
						.description("Decides and serves what the inkpost e-paper frame displays."))
				.components(new Components().addSecuritySchemes(DEVICE_KEY, new SecurityScheme()
						.type(SecurityScheme.Type.HTTP)
						.scheme("bearer")
						.description("The device key (INKPOST_DEVICE_KEY, D8)")));
	}

}
