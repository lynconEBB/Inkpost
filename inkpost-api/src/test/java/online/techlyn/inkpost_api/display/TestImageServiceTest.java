package online.techlyn.inkpost_api.display;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class TestImageServiceTest {

	private final TestImageService service = new TestImageService();

	@ParameterizedTest
	@EnumSource(TestPattern.class)
	void everyPatternIsExactly48000Bytes(TestPattern pattern) {
		assertThat(service.render(pattern)).hasSize(48000);
	}

	@Test
	void whiteIsAllOnes() {
		assertThat(service.render(TestPattern.WHITE)).containsOnly((byte) 0xFF);
	}

	@Test
	void blackIsAllZeros() {
		assertThat(service.render(TestPattern.BLACK)).containsOnly((byte) 0x00);
	}

	@Test
	void borderIsBlackAtTopLeftAndWhiteInTheMiddle() {
		byte[] image = service.render(TestPattern.BORDER);
		assertThat(image[0]).isEqualTo((byte) 0x00);
		assertThat(image[240 * MonoBitmap.BYTES_PER_ROW + 50]).isEqualTo((byte) 0xFF);
	}

	@Test
	void checkerboardSquaresAre16PixelsWide() {
		byte[] image = service.render(TestPattern.CHECKERBOARD);
		assertThat(image[0]).isEqualTo((byte) 0x00);
		assertThat(image[1]).isEqualTo((byte) 0x00);
		assertThat(image[2]).isEqualTo((byte) 0xFF);
	}

	@Test
	void leftmostPixelIsTheMostSignificantBit() {
		MonoBitmap bitmap = new MonoBitmap();
		bitmap.setBlack(0, 0);
		bitmap.setBlack(15, 1);
		byte[] bytes = bitmap.toBytes();
		assertThat(bytes[0]).isEqualTo((byte) 0x7F);
		assertThat(bytes[MonoBitmap.BYTES_PER_ROW + 1]).isEqualTo((byte) 0xFE);
	}

}
