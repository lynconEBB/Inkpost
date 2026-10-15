package online.techlyn.inkpost_api.display;

import org.springframework.stereotype.Service;

@Service
public class TestImageService {

	public byte[] render(TestPattern pattern) {
		MonoBitmap bitmap = new MonoBitmap();
		for (int y = 0; y < MonoBitmap.HEIGHT; y++) {
			for (int x = 0; x < MonoBitmap.WIDTH; x++) {
				if (pattern.isBlack(x, y)) {
					bitmap.setBlack(x, y);
				}
			}
		}
		return bitmap.toBytes();
	}

}
