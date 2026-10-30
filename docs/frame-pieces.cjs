// The pieces the frame ideas (frame-ideas.html) are made of, each as a PNG in docs/frame-pieces/, to reuse
// in the editor or anywhere else: Luli in her poses and looks, the flowers, twinkles and other decorations,
// and the borders. No texts.
//
// They're drawn by the page's own code, in 1 bit like the frames, at the size and with the options the
// frames use, with her halo, and cropped to the drawing. Pieces for the day are see-through around the
// drawing (white in the editor); pieces for the night have white lines, so they're on black: the editor puts
// a photo's see-through pixels on white. Borders stay 800 × 480, to cover the frame. The editor has no
// mirror, so the side-on poses come facing both ways.
//
// Run it with the Playwright that mise installs (npm:playwright), on the system's Chromium:
//
//   NODE_PATH=$(mise where npm:playwright)/node_modules node docs/frame-pieces.cjs

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const PAGE = path.join(__dirname, "frame-ideas.html");
const OUT = path.join(__dirname, "frame-pieces");

/** Runs in the page, with its functions: every piece as [path, PNG data URL]. */
async function drawPieces() {
	await document.fonts.load(`700 40px ${FONT}`);

	const frameCanvas = () => {
		const canvas = document.createElement("canvas");
		canvas.width = W;
		canvas.height = H;
		return canvas;
	};
	/** Frame-sized 1-bit canvases on top of each other. */
	const layers = (...canvases) => {
		const result = frameCanvas();
		for (const canvas of canvases) result.getContext("2d").drawImage(canvas, 0, 0);
		return result;
	};
	const luli = (pose, options = {}) => drawLuli(pose, { halo: true, ...options });
	const decor = (draw, night = false) => renderKit(draw, { night, lineWidth: 4 });
	const painted = (draw) => {
		const canvas = frameCanvas();
		draw(painter(canvas.getContext("2d", { willReadFrequently: true }), { her: "", halo: true }));
		return oneBitLayer(canvas, "threshold");
	};

	/** A frame-sized canvas cropped to what's drawn on it (or all of it, `whole`), on `background` or see-through. */
	const png = (canvas, { background = null, whole = false } = {}) => {
		const { data } = canvas.getContext("2d").getImageData(0, 0, W, H);
		let [left, top, right, bottom] = whole ? [0, 0, W - 1, H - 1] : [W, H, -1, -1];
		for (let y = 0; y < H && !whole; y++) {
			for (let x = 0; x < W; x++) {
				if (data[(y * W + x) * 4 + 3] === 0) continue;
				left = Math.min(left, x);
				right = Math.max(right, x);
				top = Math.min(top, y);
				bottom = Math.max(bottom, y);
			}
		}
		const result = document.createElement("canvas");
		result.width = right - left + 1;
		result.height = bottom - top + 1;
		const g = result.getContext("2d");
		if (background) {
			g.fillStyle = background;
			g.fillRect(0, 0, result.width, result.height);
		}
		g.drawImage(canvas, -left, -top);
		return result.toDataURL("image/png");
	};

	const NIGHT = { background: BLACK };
	const WHOLE = { whole: true };
	const EYES = { happy: "happy", closed: "closed", sleepy: "sleepy", wink: "wink", "one-open": "oneOpen", puppy: "puppy" };
	// Side-on poses, as in their templates, facing right and left.
	const SIDE_ON = { standing: {}, sausage: {}, sitting: {}, asleep: {}, "trotting-heart": {}, "trotting-letter": { holding: "letter" } };
	const sideOn = (name) => name.startsWith("trotting") ? "trotting" : name;

	// Sun rays rising over the horizon, with lines for the ground: Luli is the sun in "Good morning".
	const sunrise = () => decor((kit) => {
		kit.above(400, () => drawRays(kit, 220, 262, 150, 206));
		kit.stroke(pathOf((path) => {
			path.moveTo(0, 400);
			path.lineTo(W, 400);
			for (const [x, y, length] of [[120, 426, 90], [300, 440, 140], [560, 428, 120], [690, 452, 60]]) {
				path.moveTo(x, y);
				path.lineTo(x + length, y);
			}
		}));
	});

	const pieces = [
		// Luli from the front, peeking over the bottom edge, and each look on her.
		["luli/peek", () => luli("peek")],
		...Object.entries(EYES).map(([name, eyes]) => [`luli/peek-eyes-${name}`, () => luli("peek", { eyes })]),
		...["smile", "o", "yawn"].map((mouth) => [`luli/peek-mouth-${mouth}`, () => luli("peek", { mouth })]),
		["luli/peek-sunglasses", () => luli("peek", { glasses: true })],
		["luli/peek-small-puppy-eyes", () => luli("peek", { x: 690, scale: 0.5, eyes: "puppy" })],
		...["party", "night", "santa"].map((hat) => [`luli/peek-hat-${hat}`, () => luli("peek", { hat })]),
		["luli/head-top", () => luli("headTop")],
		["luli/chin", () => luli("chin")],
		["luli/upside-down", () => luli("upsideDown", { scale: 0.75 })],
		["luli/side-from-left", () => luli("side")],
		["luli/side-from-right", () => luli("side", { x: W, flip: true })],
		["luli/side-from-right-puppy-eyes", () => luli("side", { x: W, y: 300, scale: 0.85, flip: true, eyes: "puppy" })],

		// Over (or in) her props.
		["luli/over-heart", () => luli("peek", { y: 250, scale: 0.75, over: "heart" })],
		["luli/over-sign", () => luli("peek", { y: 250, scale: 0.75, over: "sign" })],
		["luli/over-sign-happy", () => luli("peek", { x: 610, y: 300, scale: 0.8, over: "sign", eyes: "happy" })],
		["luli/over-gift", () => luli("peek", { y: 260, scale: 0.75, over: "gift" })],
		["luli/over-gift-santa-hat", () => luli("peek", { x: 600, y: 300, scale: 0.7, over: "gift", hat: "santa" })],
		["luli/in-mug", () => luli("peek", { y: 290, scale: 0.6, over: "mug" })],
		["luli/in-mug-happy", () => luli("peek", { x: 590, y: 300, scale: 0.6, over: "mug", eyes: "happy" })],
		["luli/behind-cake", () => luli("peek", { y: 320, scale: 0.65, over: "cake" })],
		["luli/behind-cake-party-hat", () => luli("peek", { x: 630, y: 330, scale: 0.55, over: "cake", hat: "party", eyes: "happy" })],
		["luli/tucked-in", () => luli("peek", { y: 420, scale: 0.6, over: "blanket", eyes: "closed", mouth: "smile" })],
		["luli/tucked-in-nightcap", () => luli("peek", { y: 410, scale: 0.56, over: "blanket", eyes: "sleepy", mouth: "smile", hat: "night" })],
		["luli/rising-sun", () => layers(sunrise(), luli("peek", { x: 220, y: 400, scale: 0.75, eyes: "happy" }))],

		// Side-on, facing right and left, and as the frames use them.
		...Object.entries(SIDE_ON).flatMap(([name, look]) => [
			[`luli/${name}-right`, () => luli(sideOn(name), look)],
			[`luli/${name}-left`, () => luli(sideOn(name), { flip: true, ...look })],
		]),
		["luli/sausage-sleepy", () => luli("sausage", { y: 470, scale: 0.9, eyes: "sleepy" })],
		["luli/sitting-left-happy", () => luli("sitting", { x: 650, scale: 0.85, flip: true, eyes: "happy" })],

		// Luli at night: white lines, on black.
		["luli-night/asleep-right", () => luli("asleep", { night: true }), NIGHT],
		["luli-night/asleep-left", () => luli("asleep", { flip: true, night: true }), NIGHT],
		["luli-night/asleep-on-cloud", () => {
			const cloud = cloudPuffs(580, 462, 460);
			return layers(
				decor((kit) => kit.limb(cloud, 1)),
				luli("asleep", { x: 556, y: 402, scale: 0.62 }),
				decor((kit) => kit.inside(limbPath(cloud), () => kit.limb([380, 440, 500, 560, 620, 680, 740, 800].map((x) => [[x, 440, 52]]), 1))),
			);
		}, NIGHT],
		["luli-night/peek-yawn", () => luli("peek", { x: 610, scale: 0.95, eyes: "closed", mouth: "yawn", night: true }), NIGHT],
		["luli-night/peek-party-hat", () => luli("peek", { scale: 0.6, hat: "party", eyes: "happy", night: true }), NIGHT],
		["luli-night/side-from-left-one-eye-open", () => luli("side", { y: 280, scale: 0.95, eyes: "oneOpen", mouth: "smile", night: true }), NIGHT],

		// Decorations.
		["decorations/twinkles-small", () => decor((kit) => drawTwinkles(kit, 400, 240, 16))],
		["decorations/twinkles", () => decor((kit) => drawTwinkles(kit, 400, 240, 26))],
		["decorations/twinkles-big", () => decor((kit) => drawTwinkles(kit, 400, 240, 70))],
		["decorations/sparkle", () => painted((p) => p.sparkle(400, 240, 16))],
		["decorations/heart", () => painted((p) => p.heart(400, 240, 70))],
		["decorations/heart-outline", () => painted((p) => p.heartOutline(400, 240, 130, 10))],
		["decorations/hearts-pair", () => painted((p) => {
			p.heartOutline(350, 240, 130, 10);
			p.heart(450, 244, 130);
		})],
		["decorations/heart-dotted", () => decor((kit) => kit.part(heartPath(400, 240, 56), 0.3))],
		["decorations/hearts-trail", () => decor((kit) => {
			for (const [x, y, size] of [[456, 290, 28], [506, 254, 22], [548, 228, 16]]) kit.part(heartPath(x, y, size), 0.3);
		})],
		["decorations/leaf", () => decor((kit) => drawLeaf(kit, 370, 240, 60, -0.5))],
		...[["daisy", 30, 0.2], ["blossom", 30, 0.3], ["rose", 30, 0], ["tulip", 30, 0], ["bud", 12, 0]].map(([kind, r, angle]) => (
			[`decorations/flower-${kind}`, () => decor((kit) => drawFlower(kit, kind, 400, 240, r, angle))]
		)),
		...["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => (
			[`decorations/corner-flowers-${corner}`, () => decor((kit) => drawCornerBunch(kit, corner))]
		)),
		["decorations/vine-across", () => decor((kit) => drawVine(kit, 70, 240, 730, 240))],
		["decorations/vine-down", () => decor((kit) => drawVine(kit, 400, 70, 400, 410))],
		["decorations/heart-wreath", () => decor((kit) => drawHeartWreath(kit, 400, 226, 11.5))],
		["decorations/bouquet", () => decor((kit) => drawBouquet(kit, 220, 470))],
		["decorations/garden", () => decor((kit) => {
			const kinds = ["daisy", "tulip", "blossom", "rose", "daisy", "tulip", "blossom", "daisy", "tulip"];
			kinds.forEach((kind, i) => {
				const x = 50 + i * 87;
				const top = i % 2 ? 340 : 380;
				drawStem(kit, x, H + 10, x + (i % 3) * 4 - 4, top, i % 2 ? 10 : -10);
				drawLeaf(kit, x, 452, 40, i % 2 ? -0.5 : -2.6);
				drawFlower(kit, kind, x + (i % 3) * 4 - 4, top, kind === "rose" ? 26 : 30, kind === "tulip" ? (i % 2 ? 0.12 : -0.12) : i * 0.5);
			});
		})],
		["decorations/photo-spot", () => decor((kit) => drawPhotoSpot(kit, 220, 105, 360, 270))],
		["decorations/polaroid", () => decor((kit) => drawPolaroid(kit, 80, 56, 280, 280, 70))],
		["decorations/note", () => decor((kit) => {
			kit.at(400, 240, -0.035, () => {
				kit.part(rectPath(-226, -164, 460, 334, 8), 0.45, false);
				kit.part(rectPath(-236, -176, 460, 334, 8), 0.92);
			});
			drawBlossom(kit, 400, 72, 24, 0.2);
		})],
		["decorations/checklist", () => decor((kit) => {
			kit.part(rectPath(52, 52, 400, 392, 6), 0.45, false);
			kit.part(rectPath(40, 40, 400, 392, 6), 1);
			kit.at(240, 42, -0.06, () => kit.part(rectPath(-62, -18, 124, 36, 3), MUZZLE));
			for (let i = 0; i < 3; i++) kit.part(rectPath(76, 152 + i * 66, 36, 36, 6), 1);
			kit.part(heartPath(94, 152 + 3 * 66 + 20, 42), 0.3);
		})],
		["decorations/hanging-sign", () => decor((kit) => {
			for (const x of [250, 550]) {
				kit.stroke(pathOf((path) => {
					path.moveTo(x, -10);
					path.lineTo(x, 64);
				}), 3);
			}
			kit.part(rectPath(160, 46, 480, 128, 14), 1);
			for (const x of [250, 550]) kit.solid(circlePath(x, 62, 5));
		})],
		["decorations/speech-bubble", () => decor((kit) => kit.part(bubblePath(40, 56, 500, 280, [596, 396]), 1))],
		["decorations/speech-bubble-small", () => decor((kit) => kit.part(bubblePath(440, 230, 300, 84, [650, 340]), 1))],
		["decorations/thought-bubble", () => decor((kit) => drawThoughtBubble(kit, 165, 80, 470, 240, [205, 410]))],
		["decorations/cloud", () => decor((kit) => drawCloud(kit, 400, 400, 460))],
		["decorations/sun", () => decor((kit) => drawSun(kit, 400, 240, 70))],
		["decorations/sun-behind-cloud", () => decor((kit) => {
			drawSun(kit, 180, 210, 70);
			drawCloud(kit, 150, 370, 260);
		})],
		["decorations/bird", () => decor((kit) => drawBird(kit, 400, 240, 44))],
		["decorations/sun-rays", () => decor((kit) => drawRays(kit, 400, 240, 150, 206))],
		["decorations/sunrise", sunrise],
		["decorations/steam", () => decor((kit) => drawSteam(kit, 400, 300, 90))],
		["decorations/alarm-clock", () => decor((kit) => drawAlarmClock(kit, 400, 240, 86))],
		["decorations/plug", () => decor((kit) => drawPlug(kit, 500, 240, 56, 200))],
		["decorations/socket", () => decor((kit) => drawSocket(kit, 400, 240, 66))],
		["decorations/snowflake", () => painted((p) => p.snowflake(400, 240, 18))],
		["decorations/bunting", () => painted((p) => p.bunting())],
		["decorations/zzz", () => painted((p) => p.zzz(400, 240))],

		// Decorations at night: white, on black.
		["decorations-night/twinkles-small", () => decor((kit) => drawTwinkles(kit, 400, 240, 16), true), NIGHT],
		["decorations-night/twinkles", () => decor((kit) => drawTwinkles(kit, 400, 240, 26), true), NIGHT],
		["decorations-night/twinkles-big", () => decor((kit) => drawTwinkles(kit, 400, 240, 70), true), NIGHT],
		["decorations-night/moon", () => painted((p) => p.moon(400, 240, 52)), NIGHT],
		["decorations-night/firework", () => painted((p) => p.firework(400, 240, 48, WHITE)), NIGHT],
		["decorations-night/thought-bubble", () => decor((kit) => drawThoughtBubble(kit, 165, 80, 470, 240, [205, 410]), true), NIGHT],
		["decorations-night/zzz", () => painted((p) => p.zzz(400, 240, WHITE)), NIGHT],

		// Borders: the whole frame.
		["borders/vines", () => decor((kit) => {
			drawVine(kit, 70, 30, 730, 30);
			drawVine(kit, 70, 450, 730, 450);
			drawVine(kit, 30, 70, 30, 410);
			drawVine(kit, 770, 70, 770, 410);
			for (const [x, y] of [[34, 34], [766, 34], [34, 446], [766, 446]]) drawDaisy(kit, x, y, 30, x * 0.01);
		}), WHOLE],
		["borders/corner-flowers", () => decor((kit) => {
			for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) drawCornerBunch(kit, corner, 0.72);
		}), WHOLE],
		["borders/hearts", () => painted((p) => {
			for (let x = 40; x <= W - 40; x += 60) {
				p.heart(x, 36, 26);
				p.heart(x, H - 36, 26);
			}
			for (let y = 96; y <= H - 96; y += 72) {
				p.heart(40, y, 26);
				p.heart(W - 40, y, 26);
			}
		}), WHOLE],
		["borders/double-line", () => painted((p) => {
			p.frameRect(16, 16, W - 32, H - 32, 4);
			p.frameRect(28, 28, W - 56, H - 56, 2);
		}), WHOLE],
	];
	return pieces.map(([name, draw, options]) => [name, png(draw(), options)]);
}

(async () => {
	const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
	const page = await browser.newPage();
	await page.goto(`file://${PAGE}`);
	const pieces = await page.evaluate(drawPieces);
	await browser.close();
	for (const [name, url] of pieces) {
		const file = path.join(OUT, `${name}.png`);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
	}
	console.log(`${pieces.length} pieces in ${path.relative(process.cwd(), OUT)}/`);
})();
