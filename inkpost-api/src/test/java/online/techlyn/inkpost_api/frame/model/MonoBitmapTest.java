package online.techlyn.inkpost_api.frame.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class MonoBitmapTest {

	@Test
	void startsWhite() {
		MonoBitmap bitmap = new MonoBitmap();

		assertThat(bitmap.isBlack(0, 0)).isFalse();
		assertThat(bitmap.isBlack(799, 479)).isFalse();
	}

	@Test
	void readsBackItsBytes() {
		MonoBitmap bitmap = new MonoBitmap();
		bitmap.setBlack(9, 3);

		MonoBitmap copy = MonoBitmap.fromBytes(bitmap.toBytes());

		assertThat(copy.isBlack(9, 3)).isTrue();
		assertThat(copy.isBlack(8, 3)).isFalse();
		assertThat(copy.isBlack(10, 3)).isFalse();
		assertThat(copy.toBytes()).isEqualTo(bitmap.toBytes());
	}

	@Test
	void fromBytesNeedsExactly48000Bytes() {
		assertThatThrownBy(() -> MonoBitmap.fromBytes(new byte[47999])).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void rejectsPixelsOutsideTheImage() {
		MonoBitmap bitmap = new MonoBitmap();

		assertThatThrownBy(() -> bitmap.isBlack(800, 0)).isInstanceOf(IndexOutOfBoundsException.class);
		assertThatThrownBy(() -> bitmap.setBlack(0, -1)).isInstanceOf(IndexOutOfBoundsException.class);
	}

}
