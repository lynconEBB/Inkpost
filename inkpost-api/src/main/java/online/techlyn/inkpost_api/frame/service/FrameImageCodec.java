package online.techlyn.inkpost_api.frame.service;

import java.awt.image.BufferedImage;
import java.awt.image.WritableRaster;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.frame.model.MonoBitmap;

/**
 * Converts between the PNGs the browser renders (D19) and the display's packed bytes, through
 * {@link MonoBitmap}. Strict (D41): only an 800×480 PNG of opaque pure black and white is accepted,
 * never thresholded or dithered.
 */
public final class FrameImageCodec {

	private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
	private static final int BLACK = 0xFF000000;
	private static final int WHITE = 0xFFFFFFFF;
	private static final String ALLOWED = "only opaque black (#000000) and white (#FFFFFF) are allowed";

	private FrameImageCodec() {
	}

	/**
	 * The packed bytes of an uploaded PNG.
	 *
	 * @throws InvalidInputException on the field {@code image}, naming the first problem found
	 */
	public static byte[] decodePng(byte[] png) {
		if (png.length < PNG_SIGNATURE.length
				|| !Arrays.equals(png, 0, PNG_SIGNATURE.length, PNG_SIGNATURE, 0, PNG_SIGNATURE.length)) {
			throw invalid("is not a PNG");
		}
		BufferedImage image = readPng(png);
		int[] argb = image.getRGB(0, 0, MonoBitmap.WIDTH, MonoBitmap.HEIGHT, null, 0, MonoBitmap.WIDTH);
		MonoBitmap bitmap = new MonoBitmap();
		for (int y = 0; y < MonoBitmap.HEIGHT; y++) {
			for (int x = 0; x < MonoBitmap.WIDTH; x++) {
				int pixel = argb[y * MonoBitmap.WIDTH + x];
				if (pixel == BLACK) {
					bitmap.setBlack(x, y);
				} else if (pixel != WHITE) {
					throw invalid(describeWrongPixel(x, y, pixel));
				}
			}
		}
		return bitmap.toBytes();
	}

	/** A 1-bit PNG of the packed bytes, for the web UI to show. */
	public static byte[] encodePng(byte[] packed) {
		MonoBitmap bitmap = MonoBitmap.fromBytes(packed);
		// A two-color palette: sample 0 is black, 1 is white.
		BufferedImage image = new BufferedImage(MonoBitmap.WIDTH, MonoBitmap.HEIGHT, BufferedImage.TYPE_BYTE_BINARY);
		WritableRaster raster = image.getRaster();
		for (int y = 0; y < MonoBitmap.HEIGHT; y++) {
			for (int x = 0; x < MonoBitmap.WIDTH; x++) {
				raster.setSample(x, y, 0, bitmap.isBlack(x, y) ? 0 : 1);
			}
		}
		ByteArrayOutputStream png = new ByteArrayOutputStream();
		try {
			ImageIO.write(image, "png", png);
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
		return png.toByteArray();
	}

	/** Reads the size from the header first, so an image of the wrong size is never decoded. */
	private static BufferedImage readPng(byte[] png) {
		ImageReader reader = ImageIO.getImageReadersByFormatName("png").next();
		int width;
		int height;
		BufferedImage image = null;
		try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(png))) {
			reader.setInput(input);
			width = reader.getWidth(0);
			height = reader.getHeight(0);
			if (width == MonoBitmap.WIDTH && height == MonoBitmap.HEIGHT) {
				image = reader.read(0);
			}
		} catch (IOException | RuntimeException e) {
			// A corrupt PNG can fail inside the decoder with any exception.
			throw invalid("is not a readable PNG");
		} finally {
			reader.dispose();
		}
		if (image == null) {
			throw invalid("must be " + MonoBitmap.WIDTH + "x" + MonoBitmap.HEIGHT + " pixels, not " + width + "x" + height);
		}
		return image;
	}

	private static String describeWrongPixel(int x, int y, int argb) {
		int alpha = argb >>> 24;
		String color = alpha == 0xFF
				? String.format("#%06X", argb & 0xFFFFFF)
				: "not opaque (alpha " + alpha + ")";
		return "pixel (" + x + ", " + y + ") is " + color + "; " + ALLOWED;
	}

	private static InvalidInputException invalid(String message) {
		return new InvalidInputException("image", message);
	}

}
