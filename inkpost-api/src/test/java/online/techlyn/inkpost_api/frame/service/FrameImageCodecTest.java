package online.techlyn.inkpost_api.frame.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import javax.imageio.ImageIO;
import online.techlyn.inkpost_api.common.exception.InvalidInputException;
import online.techlyn.inkpost_api.frame.model.MonoBitmap;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;

class FrameImageCodecTest {

	@Test
	void decodesBlackAndWhitePixelsIntoThePackedBytes() {
		byte[] packed = FrameImageCodec.decodePng(TestPngs.png(TestPngs.frame(0, 0, 799, 479)));

		MonoBitmap expected = new MonoBitmap();
		expected.setBlack(0, 0);
		expected.setBlack(799, 479);
		assertThat(packed).isEqualTo(expected.toBytes());
	}

	@Test
	void roundTripsThroughPng() throws IOException {
		MonoBitmap bitmap = new MonoBitmap();
		for (int x = 0; x < MonoBitmap.WIDTH; x += 3) {
			bitmap.setBlack(x, x % MonoBitmap.HEIGHT);
		}

		byte[] png = FrameImageCodec.encodePng(bitmap.toBytes());

		BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));
		assertThat(image.getWidth()).isEqualTo(800);
		assertThat(image.getHeight()).isEqualTo(480);
		assertThat(image.getRGB(0, 0)).isEqualTo(TestPngs.BLACK);
		assertThat(image.getRGB(1, 0)).isEqualTo(TestPngs.WHITE);
		assertThat(FrameImageCodec.decodePng(png)).isEqualTo(bitmap.toBytes());
	}

	@Test
	void rejectsTheWrongSize() {
		assertInvalidImage(() -> FrameImageCodec.decodePng(TestPngs.png(TestPngs.white(480, 800))),
				"must be 800x480 pixels, not 480x800");
	}

	@Test
	void rejectsAGrayPixel() {
		BufferedImage image = TestPngs.frame();
		image.setRGB(12, 34, 0xFF808080);

		assertInvalidImage(() -> FrameImageCodec.decodePng(TestPngs.png(image)),
				"pixel (12, 34) is #808080; only opaque black (#000000) and white (#FFFFFF) are allowed");
	}

	@Test
	void rejectsATransparentPixel() {
		BufferedImage image = TestPngs.frame();
		image.setRGB(5, 6, 0x00000000);

		assertInvalidImage(() -> FrameImageCodec.decodePng(TestPngs.png(image)),
				"pixel (5, 6) is not opaque (alpha 0); only opaque black (#000000) and white (#FFFFFF) are allowed");
	}

	@Test
	void rejectsAnImageThatIsNotAPng() {
		BufferedImage rgb = new BufferedImage(800, 480, BufferedImage.TYPE_INT_RGB);

		assertInvalidImage(() -> FrameImageCodec.decodePng(TestPngs.encode(rgb, "jpg")), "is not a PNG");
		assertInvalidImage(() -> FrameImageCodec.decodePng(new byte[0]), "is not a PNG");
	}

	@Test
	void rejectsACorruptPng() {
		byte[] png = TestPngs.png(TestPngs.frame());

		assertInvalidImage(() -> FrameImageCodec.decodePng(Arrays.copyOf(png, 40)), "is not a readable PNG");
	}

	private static void assertInvalidImage(ThrowingCallable decode, String message) {
		assertThatThrownBy(decode)
				.isInstanceOfSatisfying(InvalidInputException.class, e -> assertThat(e.getErrors())
						.singleElement()
						.satisfies(error -> {
							assertThat(error.field()).isEqualTo("image");
							assertThat(error.message()).isEqualTo(message);
						}));
	}

}
