package online.techlyn.inkpost_api.frame.service;

import static org.assertj.core.api.Assertions.assertThat;

import online.techlyn.inkpost_api.frame.model.MonoBitmap;
import org.junit.jupiter.api.Test;

class FrameEtagTest {

	@Test
	void isTheQuotedHexSha256OfTheBytes() {
		assertThat(FrameEtag.of(new byte[0]))
				.isEqualTo("\"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\"");
	}

	@Test
	void changesExactlyWhenThePixelsChange() {
		MonoBitmap bitmap = new MonoBitmap();
		String white = FrameEtag.of(bitmap.toBytes());
		bitmap.setBlack(400, 240);

		assertThat(FrameEtag.of(new MonoBitmap().toBytes())).isEqualTo(white);
		assertThat(FrameEtag.of(bitmap.toBytes())).isNotEqualTo(white);
	}

}
