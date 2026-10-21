package online.techlyn.inkpost_api.frame.service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * The ETag of a frame's pixels (D17): the hex SHA-256 of its packed bytes, quoted. It changes exactly
 * when the displayed pixels change. Used by the web UI's PNG and by the device endpoint (D9).
 */
public final class FrameEtag {

	private FrameEtag() {
	}

	public static String of(byte[] packed) {
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256").digest(packed);
			return "\"" + HexFormat.of().formatHex(hash) + "\"";
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException("every JVM has SHA-256", e);
		}
	}

}
