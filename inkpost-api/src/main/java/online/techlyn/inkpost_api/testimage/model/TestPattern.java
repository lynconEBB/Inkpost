package online.techlyn.inkpost_api.testimage.model;

import online.techlyn.inkpost_api.frame.model.MonoBitmap;

/** Test images for checking orientation, bit order and polarity on the real panel. */
public enum TestPattern {

	/** 16 px squares; the top-left square is black. */
	CHECKERBOARD {
		@Override
		public boolean isBlack(int x, int y) {
			return (x / 16 + y / 16) % 2 == 0;
		}
	},
	/** 8 px vertical bands, starting black: every byte is either 0x00 or 0xFF. */
	STRIPES {
		@Override
		public boolean isBlack(int x, int y) {
			return (x / 8) % 2 == 0;
		}
	},
	/** 4 px frame plus a solid 64 px square in the top-left corner, to show orientation. */
	BORDER {
		@Override
		public boolean isBlack(int x, int y) {
			boolean frame = x < 4 || y < 4 || x >= MonoBitmap.WIDTH - 4 || y >= MonoBitmap.HEIGHT - 4;
			boolean corner = x < 64 && y < 64;
			return frame || corner;
		}
	},
	BLACK {
		@Override
		public boolean isBlack(int x, int y) {
			return true;
		}
	},
	WHITE {
		@Override
		public boolean isBlack(int x, int y) {
			return false;
		}
	};

	public abstract boolean isBlack(int x, int y);

}
