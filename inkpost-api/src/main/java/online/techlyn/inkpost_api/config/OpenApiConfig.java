package online.techlyn.inkpost_api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	@Bean
	public OpenAPI inkpostOpenApi() {
		return new OpenAPI().info(new Info()
				.title("inkpost API")
				.version("0.1")
				.description("Decides and serves what the inkpost e-paper frame displays."));
	}

}
