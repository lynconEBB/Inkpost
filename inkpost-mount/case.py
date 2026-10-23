# The frame's case: a bar the e-paper panel stands in, with a compartment for the boards under a
# lid on top. A concept of the design in prototype.blend, without its rounded edges.
#
# Setup:  python -m venv .venv && .venv/bin/pip install -r requirements.txt
# Viewer: .venv/bin/python -m ocp_viewer, then open http://127.0.0.1:3939 (leave it running)
# Build:  .venv/bin/python case.py    (writes out/case-body.stl, out/case-lid.stl, out/case.step,
#                                      and shows the case in the viewer; with no viewer running,
#                                      showing prints an error but the files are still written)
#
# Units are mm. X runs along the bar (0 = left end, seen from the front), Y from the bottom front
# edge (0) to the back, Z up from the bottom. The panel and the front face lean back, over the lid.

import math
from pathlib import Path

from build123d import (
    Align,
    Axis,
    Box,
    Compound,
    Cylinder,
    Plane,
    Polygon,
    Pos,
    export_step,
    export_stl,
    extrude,
)
from ocp_viewer import show

# Outside. The depth comes from what goes inside; see DEPTH below the HAT.
LENGTH = 171.0  # the panel is 170.2 wide
HEIGHT = 30.0  # flat top
WALL = 5.0  # sides and back; leaves 3 mm behind the lid's grooves
FLOOR = 2.0

# Waveshare 7.5" e-Paper V2 raw panel, only to see it in place; not printed
PANEL_WIDTH, PANEL_HEIGHT, PANEL_THICKNESS = 170.2, 111.2, 1.18

# The groove the panel stands in, as in the original. It runs the whole length, open at both ends.
GROOVE_ANGLE = 20.0  # degrees from vertical, leaning back
GROOVE_WIDTH = 1.5  # front to back, as the opening on top measures; square to the panel it's 1.41,
                    # for a panel about 1.2 thick
GROOVE_DEPTH = 9.0  # from the top down to its floor, where the panel's bottom edge rests
GROOVE_FLOOR_Z = HEIGHT - GROOVE_DEPTH

# The front face leans back like the panel, from the bottom front edge up
FRONT_WALL = 2.0  # in front of the groove, square to the panel

LEAN = math.tan(math.radians(GROOVE_ANGLE))  # how far the panel goes back per mm up
GROOVE_FRONT_Y = LEAN * GROOVE_FLOOR_Z + FRONT_WALL / math.cos(math.radians(GROOVE_ANGLE))  # at its floor

# The panel's flat cable goes from the groove's floor into the compartment through this opening,
# placed along the bar as in the original
CABLE_X = 68.75
CABLE_WIDTH = 30.0
CABLE_HEIGHT = 6.0  # how far below the groove's floor it opens

# The lid slides in from the right end, in grooves along the compartment's front, left and back walls,
# under a lip that keeps it from lifting out. The grooves and lips run out through the right wall,
# which is open between the lips; closed, the lid's end is flush with the right wall.
LID_THICKNESS = 2.0
LID_GROOVE_HEIGHT = 2.4  # so the lid has 0.4 mm of play
LID_GROOVE_DEPTH = 2.0  # into the walls
LID_LIP = 2.0  # of wall above the grooves
LID_CLEARANCE = 0.2  # between the lid's edges and the bottom of the grooves
LID_GROOVE_Z = HEIGHT - LID_LIP - LID_GROOVE_HEIGHT  # the grooves' floor, which the lid rests on

# The compartment's front wall stands straight up inside, so it prints without supports, and gets
# thicker towards the floor as the front face leans back. It leaves GROOVE_BACK_WALL between the
# panel's groove and the lid's, and the lid's groove is LID_GROOVE_DEPTH deep into it; inside, the
# wall is COMPARTMENT_FRONT_Y from the front.
GROOVE_BACK_WALL = 1.7
LID_GROOVE_FRONT_Y = (
    GROOVE_FRONT_Y + LEAN * (HEIGHT - LID_LIP - GROOVE_FLOOR_Z) + GROOVE_WIDTH + GROOVE_BACK_WALL
)
COMPARTMENT_FRONT_Y = LID_GROOVE_FRONT_Y + LID_GROOVE_DEPTH

# Boards sit in a frame of low walls on the floor, screwed onto a post in each corner of the frame
BOARD_CLEARANCE = 0.5  # around a board, inside its frame
FRAME_WALL = 3.0
FRAME_HEIGHT = 10.0  # above the floor
BOARD_STANDOFF = 5.0  # the posts hold a board this far above the floor
BOARD_SCREW_PILOT = 2.0  # for M2.5 x 5 screws, which pass through ~3 mm board holes

# ESP32 NodeMCU board, lying along the bar in the back left corner with its USB port through the left
# wall. The holes are typical values, not measured yet.
ESP32_LENGTH, ESP32_WIDTH, ESP32_THICKNESS = 55.0, 32.0, 1.6
ESP32_HOLE_INSET = 2.5  # hole centres from the board's edges, in each corner
ESP32_USB = (8.0, 5.5, 2.0)  # socket on top at the left end: wide, deep, tall
USB_HOLE = (12.0, 7.0)  # through the left wall, for the cable's plug: wide, tall

# Free space on the floor between the compartment's front wall and the boards' frames, for the
# panel's cable to come down from its opening and turn aside
CABLE_ROOM = 20.0

# Waveshare e-Paper Driver HAT, lying along the bar in the middle of the space right of the ESP32,
# and of the compartment's depth. Its flat cables leave through a gap in the middle of each long
# wall of its frame, both free of the compartment's walls. The holes follow the Raspberry Pi Zero
# layout the HAT is made to sit on.
HAT_LENGTH, HAT_WIDTH, HAT_THICKNESS = 65.0, 30.2, 1.6
HAT_HOLE_INSET = 3.5  # hole centres from the board's edges, in each corner
HAT_CABLE_GAP = 18.0

# At the bottom; the front leans back, so the top is LEAN * HEIGHT less. A round number, a little
# more than the boards need; the rest goes to the cable's room.
DEPTH = 80.0
assert DEPTH >= (
    COMPARTMENT_FRONT_Y + CABLE_ROOM + FRAME_WALL + 2 * BOARD_CLEARANCE + max(ESP32_WIDTH, HAT_WIDTH)
    + WALL
)

MIN = (Align.MIN, Align.MIN, Align.MIN)
UP = (Align.CENTER, Align.CENTER, Align.MIN)


def lid_corner():
    """Where the closed lid's corner nearest the origin sits, on the grooves' floor."""
    return WALL - LID_GROOVE_DEPTH + LID_CLEARANCE, LID_GROOVE_FRONT_Y + LID_CLEARANCE, LID_GROOVE_Z


def esp32_corner():
    """The ESP32's corner nearest the origin: against the left and back walls."""
    return WALL + BOARD_CLEARANCE, DEPTH - WALL - BOARD_CLEARANCE - ESP32_WIDTH


def hat_corner():
    """The HAT's corner nearest the origin: in the middle of the space right of the ESP32's frame,
    and of the compartment's depth."""
    esp32_x, _ = esp32_corner()
    left = esp32_x + ESP32_LENGTH + BOARD_CLEARANCE + FRAME_WALL
    right = LENGTH - WALL
    front, back = COMPARTMENT_FRONT_Y, DEPTH - WALL
    return (left + right - HAT_LENGTH) / 2, (front + back - HAT_WIDTH) / 2


def board_holes(corner, width, length, inset):
    """A board's hole centres, inset from each of its corners."""
    x, y = corner
    return [(hx, hy) for hx in (x + inset, x + width - inset) for hy in (y + inset, y + length - inset)]


def board_frame(corner, width, length, inset, cable_gap=0.0):
    """Walls around a board, and a post for each of its holes filling the frame's corners.

    cable_gap: a gap this wide in the middle of both long walls, for the board's cables.
    """
    x, y = corner
    c = BOARD_CLEARANCE
    inside = Pos(x - c, y - c, FLOOR) * Box(width + 2 * c, length + 2 * c, FRAME_HEIGHT, align=MIN)
    outside = Pos(x - c - FRAME_WALL, y - c - FRAME_WALL, FLOOR) * Box(
        width + 2 * (c + FRAME_WALL), length + 2 * (c + FRAME_WALL), FRAME_HEIGHT, align=MIN
    )
    frame = outside - inside
    if cable_gap:
        across = max(width, length) + 2 * (c + FRAME_WALL) + 2
        gap = (cable_gap, across) if width > length else (across, cable_gap)
        frame -= Pos(x + width / 2, y + length / 2, FLOOR) * Box(*gap, FRAME_HEIGHT + 1, align=UP)

    post = 2 * (inset + c)
    posts = [
        Pos(hx, hy, FLOOR) * Box(post, post, BOARD_STANDOFF, align=UP)
        for hx, hy in board_holes(corner, width, length, inset)
    ]
    return frame + posts


def prism(points, x0, x1):
    """A prism from x0 to x1 along the bar, from a polygon in the YZ plane."""
    return Pos(x0, 0, 0) * extrude(Plane.YZ * Polygon(*points, align=None), x1 - x0)


def along_bar(*points):
    """A prism along the whole bar, and past its ends, from a polygon in the YZ plane."""
    return prism(points, -1, LENGTH + 1)


def body():
    case = Box(LENGTH, DEPTH, HEIGHT, align=MIN)

    # Everything in front of the front face, which leans back from the bottom front edge
    top = HEIGHT + 1
    front = along_bar((-1, -1), (-LEAN, -1), (LEAN * top, top), (-1, top))

    back = DEPTH - WALL
    compartment = prism(
        [(COMPARTMENT_FRONT_Y, FLOOR), (back, FLOOR), (back, top), (COMPARTMENT_FRONT_Y, top)],
        WALL,
        LENGTH - WALL,
    )
    # The lid's grooves in the front, left and back walls, running out through the right wall, and
    # its way in: above them the right wall is open like the compartment, so the lips run to the end
    groove_x = WALL - LID_GROOVE_DEPTH
    way_depth = DEPTH - WALL + LID_GROOVE_DEPTH - LID_GROOVE_FRONT_Y
    lid_way = Pos(groove_x, LID_GROOVE_FRONT_Y, LID_GROOVE_Z) * Box(
        LENGTH + 1 - groove_x, way_depth, LID_GROOVE_HEIGHT, align=MIN
    ) + prism(
        [(COMPARTMENT_FRONT_Y, LID_GROOVE_Z), (back, LID_GROOVE_Z), (back, top), (COMPARTMENT_FRONT_Y, top)],
        LENGTH - WALL - 1,
        LENGTH + 1,
    )

    # The groove: a parallelogram leaning back, from its floor to above the top
    rise = top - GROOVE_FLOOR_Z
    y0, z0, w = GROOVE_FRONT_Y, GROOVE_FLOOR_Z, GROOVE_WIDTH
    groove = along_bar((y0, z0), (y0 + w, z0), (y0 + w + LEAN * rise, top), (y0 + LEAN * rise, top))

    cable = Pos(CABLE_X, GROOVE_FRONT_Y, GROOVE_FLOOR_Z - CABLE_HEIGHT) * Box(
        CABLE_WIDTH, COMPARTMENT_FRONT_Y + 1 - GROOVE_FRONT_Y, CABLE_HEIGHT, align=MIN
    )

    # Both boards lie along the bar. The ESP32's frame has its left and back walls inside the case's.
    esp32_board = (esp32_corner(), ESP32_LENGTH, ESP32_WIDTH, ESP32_HOLE_INSET)
    hat_board = (hat_corner(), HAT_LENGTH, HAT_WIDTH, HAT_HOLE_INSET)
    frames = board_frame(*esp32_board) + board_frame(*hat_board, cable_gap=HAT_CABLE_GAP)

    # Board screw holes go 1 mm into the floor
    board_pilots = [
        Pos(x, y, FLOOR - 1) * Cylinder(BOARD_SCREW_PILOT / 2, BOARD_STANDOFF + 2, align=UP)
        for board in (esp32_board, hat_board)
        for x, y in board_holes(*board)
    ]

    # The ESP32's USB plug goes in through the left wall, level with the socket
    _, esp32_y = esp32_corner()
    usb_z = FLOOR + BOARD_STANDOFF + ESP32_THICKNESS + ESP32_USB[2] / 2
    usb_hole = Pos(WALL / 2, esp32_y + ESP32_WIDTH / 2, usb_z) * Box(WALL + 2, USB_HOLE[0], USB_HOLE[1])

    return (
        case - front - compartment - lid_way - groove - cable + frames - board_pilots - usb_hole
    )


def lid():
    """A plate that slides in from the right; closed, its right end is flush with the right wall."""
    x, y, _ = lid_corner()
    back = DEPTH - WALL + LID_GROOVE_DEPTH - LID_CLEARANCE
    return Box(LENGTH - x, back - y, LID_THICKNESS, align=MIN)


def panel():
    """The panel standing in the groove: against its front side, on its lowest corner."""
    # The bottom edge is square to the panel, so leaning back lifts its front corner off the floor
    lift = PANEL_THICKNESS * math.sin(math.radians(GROOVE_ANGLE))
    front_y = GROOVE_FRONT_Y + LEAN * lift
    upright = Box(PANEL_WIDTH, PANEL_THICKNESS, PANEL_HEIGHT, align=MIN)
    return Pos((LENGTH - PANEL_WIDTH) / 2, front_y, GROOVE_FLOOR_Z + lift) * (
        upright.rotate(Axis.X, -GROOVE_ANGLE)
    )


def esp32():
    """The ESP32 board on its posts, with its USB port, only to see it in place; not printed."""
    x, y = esp32_corner()
    z = FLOOR + BOARD_STANDOFF
    board = Pos(x, y, z) * Box(ESP32_LENGTH, ESP32_WIDTH, ESP32_THICKNESS, align=MIN)
    width, depth, height = ESP32_USB
    usb = Pos(x + depth / 2, y + ESP32_WIDTH / 2, z + ESP32_THICKNESS) * Box(
        depth, width, height, align=UP
    )
    return board + usb


def hat():
    """The e-Paper driver HAT on its posts, only to see it in place; not printed."""
    x, y = hat_corner()
    return Pos(x, y, FLOOR + BOARD_STANDOFF) * Box(HAT_LENGTH, HAT_WIDTH, HAT_THICKNESS, align=MIN)


if __name__ == "__main__":
    out = Path(__file__).parent / "out"
    out.mkdir(exist_ok=True)

    case_body, case_lid = body(), lid()
    export_stl(case_body, out / "case-body.stl")
    export_stl(case_lid, out / "case-lid.stl")  # flat, as it prints

    # Both parts assembled, for viewing in a CAD program
    in_place = Pos(*lid_corner()) * case_lid
    case_body.label, in_place.label = "body", "lid"
    export_step(Compound(children=[case_body, in_place]), out / "case.step")

    print("case: %.1f x %.1f x %.1f mm (%.1f deep on top)" % (LENGTH, DEPTH, HEIGHT, DEPTH - LEAN * HEIGHT))
    inside = (LENGTH - 2 * WALL, DEPTH - WALL - COMPARTMENT_FRONT_Y, LID_GROOVE_Z - FLOOR)
    print("compartment inside: %.1f long, %.1f deep, %.1f tall" % inside)

    show(case_body, in_place, panel(), esp32(), hat(), names=["body", "lid", "panel", "esp32", "hat"],
         colors=["#d0d0d0", "#7fa7d9", "#303030", "#2e7d32", "#1565c0"], alphas=[1.0, 1.0, 0.6, 1.0, 1.0])
