package online.techlyn.inkpost_api.frame.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import javax.imageio.ImageIO;

/** Images like the ones the browser uploads: ARGB, as a canvas exports them. */
public final class TestPngs {

	public static final int BLACK = 0xFF000000;
	public static final int WHITE = 0xFFFFFFFF;

	private TestPngs() {
	}

	/** An opaque white image of the given size. */
	public static BufferedImage white(int width, int height) {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
		for (int y = 0; y < height; y++) {
			for (int x = 0; x < width; x++) {
				image.setRGB(x, y, WHITE);
			}
		}
		return image;
	}

	/** An 800×480 white image with black pixels at the given (x, y) pairs. */
	public static BufferedImage frame(int... blackPixels) {
		BufferedImage image = white(800, 480);
		for (int i = 0; i < blackPixels.length; i += 2) {
			image.setRGB(blackPixels[i], blackPixels[i + 1], BLACK);
		}
		return image;
	}

	public static byte[] png(BufferedImage image) {
		return encode(image, "png");
	}

	public static byte[] encode(BufferedImage image, String format) {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try {
			if (!ImageIO.write(image, format, out)) {
				throw new IllegalArgumentException("no writer for " + format);
			}
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
		return out.toByteArray();
	}

}
