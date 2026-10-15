package online.techlyn.inkpost_api.display;

import java.util.Arrays;

/**
 * An 800×480 1-bit image packed for the Waveshare 7.5" V2 (D4).
 * Row-major from the top-left, 8 horizontal pixels per byte, MSB = leftmost pixel,
 * bit 1 = white, bit 0 = black.
 */
public class MonoBitmap {

	public static final int WIDTH = 800;
	public static final int HEIGHT = 480;
	public static final int BYTES_PER_ROW = WIDTH / 8;
	public static final int SIZE_BYTES = BYTES_PER_ROW * HEIGHT;

	private final byte[] bytes = new byte[SIZE_BYTES];

	public MonoBitmap() {
		Arrays.fill(bytes, (byte) 0xFF);
	}

	public void setBlack(int x, int y) {
		if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
			throw new IndexOutOfBoundsException("pixel (" + x + ", " + y + ") outside " + WIDTH + "x" + HEIGHT);
		}
		bytes[y * BYTES_PER_ROW + x / 8] &= (byte) ~(0x80 >>> (x % 8));
	}

	public byte[] toBytes() {
		return bytes.clone();
	}

}
