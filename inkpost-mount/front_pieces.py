# Pieces to glue on the case's front face: a heart, A, N, A and another heart, in a row across the
# middle of the bar. Each is a flat piece; its back glues to the face.
#
# Build:  .venv/bin/python front_pieces.py (writes out/front-pieces.stl, the five pieces in a row,
#                                           flat on their backs as they print, an STL for each
#                                           shape, out/front-heart.stl, front-a.stl and front-n.stl,
#                                           and shows them on the case in the viewer; see case.py
#                                           for the viewer)
#
# The front face is the same in case.py and case_v2.py. The pieces stay above the base, on version
# 2's front wall, so its pieces still come apart.

import math
from pathlib import Path

from build123d import Bezier, Compound, FontStyle, Plane, Pos, Text, export_stl, extrude, make_face, scale
from ocp_viewer import show

from case_v2 import FLOOR, GROOVE_ANGLE, HEIGHT, LENGTH, panel, shell

WORD = "ANA"
LETTER_HEIGHT = 16.0  # up the face, which is 31.9 from the bottom edge to the top
HEART_WIDTH = 14.0
THICKNESS = 2.0
GAP = 6.0  # between the pieces
FONT = "Noto Sans"

# The front face, leaning back from the bottom front edge: x along the bar, y up the face, z out of it
FRONT_FACE = Plane(
    origin=(0, 0, 0),
    x_dir=(1, 0, 0),
    z_dir=(0, -math.cos(math.radians(GROOVE_ANGLE)), math.sin(math.radians(GROOVE_ANGLE))),
)
FACE_HEIGHT = HEIGHT / math.cos(math.radians(GROOVE_ANGLE))


def centred(piece):
    """A piece moved so the middle of its outline is at the origin."""
    middle = piece.bounding_box().center()
    return Pos(-middle.X, -middle.Y, 0) * piece


def heart():
    """A heart from four curves, as in frame-ideas.html, pointing down."""
    s = HEART_WIDTH / 2
    point, dip = (0, -0.85 * s), (0, 0.45 * s)
    left, right = (-s, 0.35 * s), (s, 0.35 * s)
    outline = [
        Bezier(point, (-0.55 * s, -0.4 * s), (-1.05 * s, -0.05 * s), left),
        Bezier(left, (-0.95 * s, 0.95 * s), (-0.2 * s, 1.05 * s), dip),
        Bezier(dip, (0.2 * s, 1.05 * s), (0.95 * s, 0.95 * s), right),
        Bezier(right, (1.05 * s, -0.05 * s), (0.55 * s, -0.4 * s), point),
    ]
    return centred(extrude(make_face(outline), THICKNESS))


def letter(char):
    """A capital, LETTER_HEIGHT tall."""
    text = Text(char, 10, font=FONT, font_style=FontStyle.BOLD)
    text = scale(text, LETTER_HEIGHT / text.bounding_box().size.Y)
    return centred(extrude(text, THICKNESS))


def pieces():
    """The pieces in a row, flat, the row centred on x 0."""
    row = [heart(), *(letter(char) for char in WORD), heart()]
    widths = [piece.bounding_box().size.X for piece in row]
    x = -(sum(widths) + GAP * (len(row) - 1)) / 2
    placed = []
    for piece, width in zip(row, widths):
        placed.append(Pos(x + width / 2, 0, 0) * piece)
        x += width + GAP
    return placed


def on_face(piece):
    """A flat piece in the middle of the front face, its back on the face."""
    return FRONT_FACE * Pos(LENGTH / 2, FACE_HEIGHT / 2, 0) * piece


if __name__ == "__main__":
    out = Path(__file__).parent / "out"
    out.mkdir(exist_ok=True)

    row = pieces()
    export_stl(Compound(row), out / "front-pieces.stl")
    for name, piece in {"heart": heart(), **{char: letter(char) for char in WORD}}.items():
        export_stl(piece, out / f"front-{name.lower()}.stl")

    shown = [on_face(piece) for piece in row]
    assert min(piece.bounding_box().min.Z for piece in shown) > FLOOR  # clear of version 2's base
    width = sum(piece.bounding_box().size.X for piece in row) + GAP * (len(row) - 1)
    print("front pieces: %.1f wide, %.1f tall, %.1f thick" % (width, LETTER_HEIGHT, THICKNESS))

    names = ["heart-left", *(f"{char}-{i}" for i, char in enumerate(WORD, 1)), "heart-right"]
    show(shell(), panel(), *shown, names=["case", "panel", *names],
         colors=["#d0d0d0", "#303030"] + ["#c2185b"] * len(shown), alphas=[1.0, 0.6] + [1.0] * len(shown))
