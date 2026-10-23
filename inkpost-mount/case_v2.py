# The frame's case, version 2: case.py's case in pieces that go together without glue. A base with
# the boards' frames, and a front, back, left and right wall that stand on it, held by pins under
# them in holes in the base, like Lego; the lid slides in as before and holds their tops.
#
# Setup:  python -m venv .venv && .venv/bin/pip install -r requirements.txt
# Viewer: .venv/bin/python -m ocp_viewer, then open http://127.0.0.1:3939 (leave it running)
# Build:  .venv/bin/python case_v2.py (writes an STL for each piece and case.step to out/v2/, and
#                                      shows the case in the viewer; with no viewer running,
#                                      showing prints an error but the files are still written)
#
# The walls' STLs are upside down, as they print: on their flat tops, pins up, so nothing needs
# supports.
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
    chamfer,
    export_step,
    export_stl,
    extrude,
)
from ocp_viewer import show

# Outside. The depth comes from what goes inside; see DEPTH below the HAT.
LENGTH = 171.0  # the panel is 170.2 wide
HEIGHT = 30.0  # flat top
WALL = 5.0  # sides and back; leaves 3 mm behind the lid's grooves
FLOOR = 4.0  # the base, under everything; 2 in case.py, thicker here for the pins' holes

# The walls stand on the base, each held by pins under it in holes in the base
PIN_DIAMETER = 3.0
PIN_LENGTH = 2.5
PIN_CHAMFER = 0.4  # round the pin's tip, so it finds its hole
PIN_HOLE = 3.2  # a snug fit; change it if the printer makes the pins too tight or too loose
PIN_HOLE_DEPTH = PIN_LENGTH + 0.5  # so the wall, not the pin, rests on the base
PINS_FRONT_BACK = 4  # under each of the front and back walls, which run the whole length
PINS_SIDE = 2  # under each of the left and right walls, between the front and back ones
JOINT_GAP = 0.2  # between the ends of the left and right walls and the front and back walls
# The left and right walls also have pins at each end, level, into holes in the front and back
# walls' inner faces. They stay below the lid's grooves, which keeps the front wall's holes clear of
# them and of the panel's groove.
PINS_END = 2

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


def shell():
    """case.py's case without the boards' frames: the base and the walls in one piece."""
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

    # The ESP32's USB plug goes in through the left wall, level with the socket
    _, esp32_y = esp32_corner()
    usb_z = FLOOR + BOARD_STANDOFF + ESP32_THICKNESS + ESP32_USB[2] / 2
    usb_hole = Pos(WALL / 2, esp32_y + ESP32_WIDTH / 2, usb_z) * Box(WALL + 2, USB_HOLE[0], USB_HOLE[1])

    return case - front - compartment - lid_way - groove - cable - usb_hole


def wall_regions():
    """Where each wall is: everything above the base, cut where the compartment's walls meet. The
    front and back walls run the whole length; the left and right ones go between them."""
    top = HEIGHT + 1
    back = DEPTH - WALL
    side_y = COMPARTMENT_FRONT_Y + JOINT_GAP
    side_depth = back - COMPARTMENT_FRONT_Y - 2 * JOINT_GAP
    return {
        "front": Pos(-1, -1, FLOOR) * Box(LENGTH + 2, COMPARTMENT_FRONT_Y + 1, top, align=MIN),
        "back": Pos(-1, back, FLOOR) * Box(LENGTH + 2, WALL + 1, top, align=MIN),
        "left": Pos(-1, side_y, FLOOR) * Box(WALL + 1, side_depth, top, align=MIN),
        "right": Pos(LENGTH - WALL, side_y, FLOOR) * Box(WALL + 1, side_depth, top, align=MIN),
    }


def spread(start, end, count):
    """count points evenly along a line from start to end, each in the middle of its share."""
    return [start + (end - start) * (i + 0.5) / count for i in range(count)]


def pin_spots():
    """Where each wall's pins go: in the middle of its thickness at the bottom, spread along it."""
    side = spread(COMPARTMENT_FRONT_Y, DEPTH - WALL, PINS_SIDE)
    along = spread(0, LENGTH, PINS_FRONT_BACK)
    front_y = (LEAN * FLOOR + COMPARTMENT_FRONT_Y) / 2  # the front face leans back from y 0
    return {
        "front": [(x, front_y) for x in along],
        "back": [(x, DEPTH - WALL / 2) for x in along],
        "left": [(WALL / 2, y) for y in side],
        "right": [(LENGTH - WALL / 2, y) for y in side],
    }


def end_pin_spots():
    """Where the left and right walls' end pins go: each wall's (x, front end's y, back end's y),
    and the pins' heights, the same at every end."""
    front, back = COMPARTMENT_FRONT_Y + JOINT_GAP, DEPTH - WALL - JOINT_GAP
    ends = [(WALL / 2, front, back), (LENGTH - WALL / 2, front, back)]
    return ends, spread(FLOOR, LID_GROOVE_Z, PINS_END)


def pin(length=PIN_LENGTH):
    """A pin hanging from the bottom of a wall at the origin, its tip chamfered."""
    p = Cylinder(PIN_DIAMETER / 2, length, align=(Align.CENTER, Align.CENTER, Align.MAX))
    return chamfer(p.edges().group_by(Axis.Z)[0], PIN_CHAMFER)


def pin_hole():
    """A pin's hole going down from the origin, and 1 mm up out of the face it is in."""
    return Pos(0, 0, 1) * Cylinder(
        PIN_HOLE / 2, PIN_HOLE_DEPTH + 1, align=(Align.CENTER, Align.CENTER, Align.MAX)
    )


# Turn a pin or hole that goes down so it goes towards the front (-Y) or the back (+Y)
TO_FRONT, TO_BACK = -90, 90


def walls(case_shell):
    """The four walls, in place, each with its pins, and the holes for the end pins."""
    spots = pin_spots()
    pieces = {
        name: (case_shell & region) + [Pos(x, y, FLOOR) * pin() for x, y in spots[name]]
        for name, region in wall_regions().items()
    }

    # The end pins also cross the joint's gap
    end_pin = pin(PIN_LENGTH + JOINT_GAP)
    ends, heights = end_pin_spots()
    for name, (x, front, back) in zip(("left", "right"), ends):
        pieces[name] += [
            Pos(x, y, z) * end_pin.rotate(Axis.X, turn)
            for y, turn in ((front, TO_FRONT), (back, TO_BACK))
            for z in heights
        ]
        for wall, y, turn in (("front", COMPARTMENT_FRONT_Y, TO_FRONT), ("back", DEPTH - WALL, TO_BACK)):
            pieces[wall] -= [Pos(x, y, z) * pin_hole().rotate(Axis.X, turn) for z in heights]
    return pieces


def base(case_shell):
    """The base, with the boards' frames and the holes for the walls' pins."""
    slab = case_shell & Box(LENGTH, DEPTH, FLOOR, align=MIN)

    # Both boards lie along the bar. The ESP32 is against the left and back walls, which stand where
    # its frame's left and back walls would be, so only the part inside the compartment is kept.
    esp32_board = (esp32_corner(), ESP32_LENGTH, ESP32_WIDTH, ESP32_HOLE_INSET)
    hat_board = (hat_corner(), HAT_LENGTH, HAT_WIDTH, HAT_HOLE_INSET)
    inside = Pos(WALL, COMPARTMENT_FRONT_Y, FLOOR) * Box(
        LENGTH - 2 * WALL, DEPTH - WALL - COMPARTMENT_FRONT_Y, FRAME_HEIGHT, align=MIN
    )
    frames = (board_frame(*esp32_board) + board_frame(*hat_board, cable_gap=HAT_CABLE_GAP)) & inside

    # Board screw holes go 1 mm into the floor
    board_pilots = [
        Pos(x, y, FLOOR - 1) * Cylinder(BOARD_SCREW_PILOT / 2, BOARD_STANDOFF + 2, align=UP)
        for board in (esp32_board, hat_board)
        for x, y in board_holes(*board)
    ]
    pin_holes = [
        Pos(x, y, FLOOR - PIN_HOLE_DEPTH) * Cylinder(PIN_HOLE / 2, PIN_HOLE_DEPTH + 1, align=UP)
        for spots in pin_spots().values()
        for x, y in spots
    ]
    return slab + frames - board_pilots - pin_holes


def as_printed(wall):
    """A wall turned upside down onto its flat top, pins up, on the bed at the origin."""
    flipped = wall.rotate(Axis.X, 180)
    low = flipped.bounding_box().min
    return Pos(-low.X, -low.Y, -low.Z) * flipped


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
    out = Path(__file__).parent / "out" / "v2"
    out.mkdir(parents=True, exist_ok=True)

    case_shell = shell()
    case_base, case_walls, case_lid = base(case_shell), walls(case_shell), lid()
    export_stl(case_base, out / "base.stl")
    for name, wall in case_walls.items():
        export_stl(as_printed(wall), out / f"wall-{name}.stl")
    export_stl(case_lid, out / "lid.stl")  # flat, as it prints

    # All the pieces assembled, for viewing in a CAD program
    in_place = Pos(*lid_corner()) * case_lid
    pieces = {"base": case_base, **case_walls, "lid": in_place}
    for name, piece in pieces.items():
        piece.label = name
    export_step(Compound(children=list(pieces.values())), out / "case.step")

    print("case: %.1f x %.1f x %.1f mm (%.1f deep on top)" % (LENGTH, DEPTH, HEIGHT, DEPTH - LEAN * HEIGHT))
    inside = (LENGTH - 2 * WALL, DEPTH - WALL - COMPARTMENT_FRONT_Y, LID_GROOVE_Z - FLOOR)
    print("compartment inside: %.1f long, %.1f deep, %.1f tall" % inside)

    shown = {**pieces, "panel": panel(), "esp32": esp32(), "hat": hat()}
    colors = ["#d0d0d0", "#b0b0b0", "#c4c4c4", "#a8a8a8", "#bcbcbc", "#7fa7d9", "#303030", "#2e7d32",
              "#1565c0"]
    show(*shown.values(), names=list(shown), colors=colors, alphas=[1.0] * 6 + [0.6, 1.0, 1.0])
