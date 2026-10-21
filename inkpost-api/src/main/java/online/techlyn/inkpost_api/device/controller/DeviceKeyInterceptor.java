package online.techlyn.inkpost_api.device.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Lets only the frame into {@code /device/**} (registered in {@code config/WebConfig}): the request must
 * send {@code Authorization: Bearer <inkpost.device-key>} (D8), or it gets an empty {@code 401}. Every
 * response there, errors included, is {@code Cache-Control: no-store} so Cloudflare never caches it (D16).
 */
@Component
public class DeviceKeyInterceptor implements HandlerInterceptor {

	private final byte[] expected;

	public DeviceKeyInterceptor(@Value("${inkpost.device-key}") String deviceKey) {
		if (deviceKey.isBlank()) {
			throw new IllegalStateException("inkpost.device-key (INKPOST_DEVICE_KEY) must not be blank");
		}
		this.expected = ("Bearer " + deviceKey).getBytes(StandardCharsets.UTF_8);
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
		String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
		byte[] sent = authorization == null ? new byte[0] : authorization.getBytes(StandardCharsets.UTF_8);
		// Constant time: how long it takes depends only on the length of the first argument, what was sent.
		if (MessageDigest.isEqual(sent, expected)) {
			return true;
		}
		response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
		response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
		return false;
	}

}
