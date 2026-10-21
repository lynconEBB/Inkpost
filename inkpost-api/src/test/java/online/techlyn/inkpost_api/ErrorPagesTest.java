package online.techlyn.inkpost_api;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Pages get Boot's HTML error page, and the API keeps its Problem Details (D41, D42). Over a real HTTP
 * connection: MockMvc never forwards to the error page, and doesn't enforce the upload limit.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ErrorPagesTest {

	private static final String BOUNDARY = "inkpost-test-boundary";

	private final HttpClient client = HttpClient.newHttpClient();

	@Value("${local.server.port}")
	private int port;

	@Test
	void anUnknownPageGetsTheHtmlErrorPage() throws Exception {
		HttpResponse<String> response = send(request("/nope").header("Accept", "text/html").GET());

		assertThat(response.statusCode()).isEqualTo(404);
		assertThat(contentType(response)).startsWith("text/html");
		assertThat(response.body()).contains("<h1>Page not found</h1>").contains("href=\"/\"");
	}

	@Test
	void aBadPageUrlGetsTheHtmlErrorPage() throws Exception {
		HttpResponse<String> response = send(request("/rules/abc").header("Accept", "text/html").GET());

		assertThat(response.statusCode()).isEqualTo(400);
		assertThat(contentType(response)).startsWith("text/html");
		assertThat(response.body()).contains("<h1>Something went wrong</h1>");
	}

	@Test
	void anUnknownRuleIsStillProblemDetails() throws Exception {
		HttpResponse<String> response = send(request("/api/rules/999").header("Accept", "application/json").GET());

		assertThat(response.statusCode()).isEqualTo(404);
		assertThat(contentType(response)).isEqualTo("application/problem+json");
		assertThat(response.body()).contains("\"detail\":\"Rule 999 not found\"");
	}

	@Test
	void aTooLargeUploadIsStillProblemDetails() throws Exception {
		HttpResponse<String> response = send(request("/api/frames")
				.header("Content-Type", "multipart/form-data; boundary=" + BOUNDARY)
				.POST(HttpRequest.BodyPublishers.ofByteArray(upload(new byte[2_500_000]))));

		assertThat(response.statusCode()).isEqualTo(413);
		assertThat(contentType(response)).isEqualTo("application/problem+json");
		assertThat(response.body()).contains("\"status\":413");
	}

	private HttpRequest.Builder request(String path) {
		return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
	}

	private HttpResponse<String> send(HttpRequest.Builder request) throws IOException, InterruptedException {
		return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
	}

	private static String contentType(HttpResponse<String> response) {
		return response.headers().firstValue("Content-Type").orElse("");
	}

	/** A frame upload, as the upload page sends it: the name and the image. */
	private static byte[] upload(byte[] image) throws IOException {
		ByteArrayOutputStream body = new ByteArrayOutputStream();
		body.write(("--" + BOUNDARY + "\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nToo big\r\n").getBytes(UTF_8));
		body.write(("--" + BOUNDARY + "\r\nContent-Disposition: form-data; name=\"image\"; filename=\"frame.png\"\r\n"
				+ "Content-Type: image/png\r\n\r\n").getBytes(UTF_8));
		body.write(image);
		body.write(("\r\n--" + BOUNDARY + "--\r\n").getBytes(UTF_8));
		return body.toByteArray();
	}

}
