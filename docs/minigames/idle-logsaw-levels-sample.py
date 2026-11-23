#!/usr/bin/env python3
"""Generates idle-logsaw-levels-sample.svg: the design of the log saw (saw 1, row 1) by level, in two versions, like idle-plank-saw4-sample.svg does for the plank saw.
Level 1: one tool, four passes (cut, back, quarter roll); level 25: two tools, two passes; level 50: four tools, one pass (all four flats at once, no roll). The trunk always moves at the conveyors' speed.
  A: circular discs (what the game has now): far side, near side (half transparent: a spinning blur), above, below (in a slot of the belt).
  B: the plank saw's kind of blade: flat rectangular blades that slide back and forth, both ends always inside a post: horizontal ones for the top and bottom flats (level 25), vertical ones for the far and near flats (level 50).
Run: python3 docs/minigames/idle-logsaw-levels-sample.py > docs/minigames/idle-logsaw-levels-sample.svg
Reuses the helpers of idle-logsaw1-sample.py (everything before its variant A): the trunk with flats (`extrude`), the belt, the toothed disc, slabs, dust."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-logsaw1-sample.py')).read()
exec(src[:src.index('# ---------- A:')])

SX = 2.0                      # the saw's plane in version A
SIDES_A = [math.pi, 0, math.pi / 2, -math.pi / 2]       # far, near, top, bottom: the order the discs are added in
SIDES_B = [math.pi / 2, -math.pi / 2, math.pi, 0]       # top, bottom, far, near: the order the blades are added in
TOP_Z, BOT_Z = CH + R + FLAT, CH + R - FLAT              # the planes of the top and bottom flats
NEAR_Y = 2 * CY - SAW_Y                                  # the plane of the near flat (SAW_Y is the far one)


def flats(sides, per_pass, pass_, rolled, current):
    """Angles of the flats on the trunk in pass `pass_`: those of the earlier passes and, when `current`, of this one, each turned back by the quarter rolls since (same rule as `sawFlats` in the game)."""
    res = []
    for q in range(pass_ if not current else pass_ + 1)[::-1]:
        for d in range(per_pass):
            res.append(sides[d] - (pass_ - q + rolled) * math.pi / 2)
    return res


def turn_arrow(ox, oy, xc):
    cz = CH + R
    pts = [P(xc, CY + 0.5 * math.cos(a), cz + 0.5 * math.sin(a), ox, oy) for a in [0.2 + i * 0.12 for i in range(11)]]
    for p, q in zip(pts, pts[1:]):
        line(p, q, INK, 3.2)
    a = 0.2 + 10 * 0.12
    tip = P(xc, CY + 0.5 * math.cos(a + 0.2), cz + 0.5 * math.sin(a + 0.2), ox, oy)
    for d in (-0.35, 0.35):
        line(tip, P(xc, CY + 0.38 * math.cos(a - 0.05 + d * 0.5), cz + 0.38 * math.sin(a - 0.05 + d * 0.5), ox, oy), INK, 3.2)


def rollers(ox, oy, glow):
    for i in range(5):
        block(-0.2 + i * 0.18, CY - 0.3, CH, ox, oy, ORANGE if glow else STEEL_D, 1, 0.1, 0.6, 0.03)


def blur(fn):
    """Runs a drawing function and makes what it drew half transparent (the near and top discs: a spinning blur you can see the trunk through)."""
    start = len(out)
    fn()
    out.insert(start, '<g opacity="0.5">')
    out.append('</g>')


def flat_toothed(cx, cy, z, r, ox, oy, phase, teeth=16):
    """A toothed disc lying flat (horizontal)."""
    pts = [P(cx + (r if i % 2 == 0 else r * 0.86) * math.cos(phase + i * math.pi / teeth), cy + (r if i % 2 == 0 else r * 0.86) * math.sin(phase + i * math.pi / teeth), z, ox, oy) for i in range(teeth * 2)]
    poly(pts, STEEL_L, 1.6)
    poly([P(cx + r * 0.25 * math.cos(i * math.pi / 8), cy + r * 0.25 * math.sin(i * math.pi / 8), z, ox, oy) for i in range(16)], STEEL_D, 1.4)


# ============================ A: circular discs ============================
def machine_a(ox, oy, discs, kind, pass_, k, ms=0.0):
    """kind idle | cut (the saw is half way through the trunk) | roll | done; k = cuts made so far."""
    passes = 4 // discs
    conveyor(ox, oy)
    if discs == 4:                                               # the bottom disc lies in a slot of the belt, only its rim shows
        block(SX - 0.5, CY - 0.45, CH - 0.005, ox, oy, '#1f1f1f', 1, 1.0, 0.9, 0.012)
        flat_toothed(SX, CY, BOT_Z - 0.03, 0.42, ox, oy, ms)
    block(1.65, 0.1, 0, ox, oy, BLUE, 1, 0.7, 0.45, 1.9)                       # frame behind the saw
    block(1.8, 0.55, 1.25, ox, oy, STEEL_D, 1, 0.4, 0.45, 0.3)                 # arbor
    toothed(SAW_Y, SX, 1.4, 0.95, ox, oy, ms)
    block(1.65, 0.1, 1.9, ox, oy, shade(BLUE, 0.9), 1, 0.7, 0.45, 0.2)         # hood
    slabs(ox, oy, k, 2.35, 3.1, 0.35)
    if kind == 'cut':
        xs = 1.0
        extrude(xs, SX, ox, oy, flats(SIDES_A, discs, pass_, 0, False))
        extrude(SX, xs + 2.0, ox, oy, flats(SIDES_A, discs, pass_, 0, True))
        dust(ox, oy, [(2.15, 0.85, 0.7, 0.2)], 80 + pass_, 4)
        if discs > 1:
            dust(ox, oy, [(2.15, 1.55, 0.7, 0.2)], 90 + pass_, 4)
        arrow(ox, oy, 0.2, 0.8, 2.15, 0.15)
    elif kind == 'roll':
        rollers(ox, oy, True)
        extrude(-0.4, 1.6, ox, oy, flats(SIDES_A, discs, pass_, 0.5, True))
        turn_arrow(ox, oy, 0.6)
    elif kind == 'done':
        extrude(3.0, 5.0, ox, oy, flats(SIDES_A, discs, passes - 1, 0, True))
    if discs >= 2:                                               # in front of the trunk: two posts with a beam beside its path, the near disc hangs from a strut
        for x in (SX - 0.8, SX + 0.65):
            block(x, 2.0, 0, ox, oy, BLUE, 1, 0.15, 0.3, 1.9)
        block(SX - 0.8, 2.0, 1.9, ox, oy, shade(BLUE, 0.9), 1, 1.6, 0.3, 0.14)
        block(SX - 0.08, 2.0, 1.25, ox, oy, STEEL_D, 1, 0.16, 0.3, 0.7)
        block(SX - 0.1, NEAR_Y, 1.25, ox, oy, STEEL_D, 1, 0.2, 2.0 - NEAR_Y, 0.3)
        blur(lambda: toothed(NEAR_Y, SX, 1.4, 0.95, ox, oy, ms + 0.3))
    if discs == 4:                                               # the top disc hangs from a beam out of the far frame
        block(SX - 0.1, 0.55, 1.62, ox, oy, STEEL_D, 1, 0.2, CY + 0.1 - 0.55, 0.12)
        block(SX - 0.1, CY - 0.1, TOP_Z + 0.02, ox, oy, STEEL_D, 1, 0.2, 0.2, 1.62 - TOP_Z)
        blur(lambda: flat_toothed(SX, CY, TOP_Z + 0.02, 0.55, ox, oy, ms + 0.6))


# ============================ B: flat sliding blades ============================
BX, DEPTH, PITCH, BW = 1.65, 0.17, 0.21, 0.24       # the blade's body starts at BX, its teeth stick out towards -x by DEPTH
POST_Y0, POST_Y1 = 0.3, 2.1                          # the posts' inner faces (the horizontal blades go into them)
Z_LO, Z_HI = CH, 1.95                                # the vertical blades go into the belt (a slot) and into the beam over the trunk
STROKE = 0.3
BXV = BX + 1.3                                       # the vertical blades (level 50) stand this much further down the line, inside the same (wider) portal, so they never cross the horizontal ones


def teeth_edge(a, b, start, length, fn, pitch=PITCH, depth=DEPTH):
    """The ratchet of big teeth along [a, b] for a blade that starts at `start` and is `length` long; fn(u, d) gives the screen point for position u along the blade and tooth depth d."""
    ya, yb = max(a, start), min(b, start + length)
    cl = lambda u: max(ya, min(yb, u))
    k0, k1 = int((ya - start) / pitch) - 1, int((yb - start) / pitch) + 1
    pts = [fn(ya, 0)]
    for k in range(k0, k1 + 1):
        pts += [fn(cl(start + pitch * (k + 0.55)), depth), fn(cl(start + pitch * (k + 1)), 0)]
    return pts, ya, yb


def plate_h(ox, oy, s, z):
    """A horizontal blade at height z, shifted s along y; the ends inside the posts are not drawn."""
    length = (POST_Y1 - POST_Y0) + 2 * STROKE
    start = POST_Y0 - STROKE + s
    pts, ya, yb = teeth_edge(POST_Y0, POST_Y1, start, length, lambda u, d: P(BX - d, u, z, ox, oy))
    pts += [P(BX + BW, yb, z, ox, oy), P(BX + BW, ya, z, ox, oy)]
    poly(pts, STEEL_L, 2.2)


def plate_v(ox, oy, s, y, bx=None):
    """A vertical blade in the plane y, shifted s along z: its lower end goes into the belt, its upper end into the beam. `bx` = where its body starts (it stands further down the line than the horizontal blades)."""
    bx = BXV if bx is None else bx
    length = (Z_HI - Z_LO) + 2 * STROKE
    start = Z_LO - STROKE + s
    pts, za, zb = teeth_edge(Z_LO, Z_HI, start, length, lambda u, d: P(bx - d, y, u, ox, oy))
    pts += [P(bx + BW, y, zb, ox, oy), P(bx + BW, y, za, ox, oy)]
    poly(pts, STEEL_L, 2.2)


def slot_post(ox, oy, y, z):
    """The opening in a post's inner face the horizontal blade slides into."""
    x0, x1 = BX - DEPTH - 0.04, BX + BW + 0.04
    poly([P(x0, y, z + 0.025, ox, oy), P(x1, y, z + 0.025, ox, oy), P(x1, y, z - 0.02, ox, oy), P(x0, y, z - 0.02, ox, oy)], '#1f1f1f', 1.4)


def slot_belt(ox, oy, y):
    """The slit in the belt the vertical blade goes down into."""
    x0, x1 = BXV - DEPTH - 0.04, BXV + BW + 0.04
    poly([P(x0, y - 0.03, CH + 0.004, ox, oy), P(x1, y - 0.03, CH + 0.004, ox, oy), P(x1, y + 0.03, CH + 0.004, ox, oy), P(x0, y + 0.03, CH + 0.004, ox, oy)], '#1f1f1f', 1.2)


SXB = BX - DEPTH / 2             # where the horizontal blades meet the trunk
SXV = BXV - DEPTH / 2            # where the vertical ones do


def machine_b(ox, oy, blades, kind, pass_, k, s=0.0):
    """kind idle | cut | roll | done; s = how far the blades are shifted along their stroke (-STROKE..STROKE)."""
    passes = 4 // blades
    horiz_z = [TOP_Z, BOT_Z]
    conveyor(ox, oy)
    pw0 = DEPTH + BW + 0.12                                                     # a post is just wide enough for the blade's slot
    px0, pw = BX - DEPTH - 0.06, pw0 + (BXV - BX if blades >= 4 else 0)   # at level 50 the portal is wider: the vertical blades stand further down inside it
    block(px0, 0.0, 0, ox, oy, BLUE, 1, pw, POST_Y0, 2.0)                       # far post
    if blades >= 1:
        slot_post(ox, oy, POST_Y0, TOP_Z)
    if blades >= 2:
        slot_post(ox, oy, POST_Y0, BOT_Z)
    if blades >= 4:
        slot_belt(ox, oy, SAW_Y); slot_belt(ox, oy, NEAR_Y)
        plate_v(ox, oy, -s, SAW_Y)                                              # the far blade, behind the trunk
    if blades >= 2:
        plate_h(ox, oy, s, BOT_Z - 0.01)                                        # the bottom blade skims the belt, under the trunk
    slabs(ox, oy, k, 3.5 if blades >= 4 else 2.35, 4.25 if blades >= 4 else 3.1, 0.35)
    if kind == 'cut' and blades >= 4:          # three stretches: nothing yet, the horizontal blades' flats, then all four
        xs = 1.2
        extrude(xs, SXB, ox, oy, [])
        extrude(SXB, SXV, ox, oy, flats(SIDES_B, 2, 0, 0, True))
        extrude(SXV, xs + 2.0, ox, oy, flats(SIDES_B, 4, 0, 0, True))
        dust(ox, oy, [(BX + 0.5, 1.0, 0.95, 0.2), (BX + 0.5, 1.5, 0.95, 0.2), (BXV + 0.5, 1.0, 0.7, 0.2), (BXV + 0.5, 1.55, 0.7, 0.2)], 170 + blades, 3)
        arrow(ox, oy, 0.2, 0.7, 2.15, 0.15)
    elif kind == 'cut':
        xs = 0.8
        extrude(xs, SXB, ox, oy, flats(SIDES_B, blades, pass_, 0, False))
        extrude(SXB, xs + 2.0, ox, oy, flats(SIDES_B, blades, pass_, 0, True))
        dust(ox, oy, [(BX + 0.5, 1.0, 0.95, 0.2), (BX + 0.5, 1.5, 0.95, 0.2)], 170 + pass_ + blades, 3)
        arrow(ox, oy, 0.2, 0.7, 2.15, 0.15)
    elif kind == 'roll':
        rollers(ox, oy, True)
        extrude(-0.4, 1.6, ox, oy, flats(SIDES_B, blades, pass_, 0.5, True))
        turn_arrow(ox, oy, 0.6)
    elif kind == 'done':
        extrude(3.9 if blades >= 4 else 3.0, 5.9 if blades >= 4 else 5.0, ox, oy, flats(SIDES_B, blades, passes - 1, 0, True))
    plate_h(ox, oy, s, TOP_Z + 0.005)                                           # the top blade lies on the trunk
    if blades >= 4:
        plate_v(ox, oy, -s, NEAR_Y)                                             # the near blade, in front of the trunk
    for x0 in ([px0, BXV - DEPTH - 0.06] if blades >= 4 else [px0]):             # near post (at level 50 two slim ones at the ends of the wider portal, so you can look in between)
        block(x0, POST_Y1, 0, ox, oy, BLUE, 1, pw0, 0.3, 2.0)
    block(px0, 0.0, 2.0, ox, oy, shade(BLUE, 0.9), 1, pw, POST_Y1 + 0.3, 0.14)  # cross beam


# ============================ the sheet ============================
IDLE, CUT, ROLL, DONE = 'idle', 'cut', 'roll', 'done'
ROWS = [
    ('A', 'Level 1: one disc, four passes', 'the disc on the far side takes one flat off per pass: forward through it, back, a quarter roll on the belt (orange rollers), four times; the last pass goes on out',
     1, [(IDLE, 0, 0, 'Idle'), (CUT, 0, 1, 'Pass 1: far flat'), (ROLL, 0, 1, 'Back, rolls itself'), (CUT, 3, 4, 'Pass 4: last flat'), (DONE, 3, 4, 'Done: square log')]),
    ('A', 'Level 25: two discs, two passes', 'a second disc on the near side (half transparent, a spinning blur) cuts the opposite flat in the same pass: two flats per pass, one roll in between',
     2, [(IDLE, 0, 0, 'Idle'), (CUT, 0, 2, 'Pass 1: far and near flat'), (ROLL, 0, 2, 'Back, rolls itself'), (CUT, 1, 4, 'Pass 2: the other two'), (DONE, 1, 4, 'Done: square log')]),
    ('A', 'Level 50: four discs, one pass', 'discs above and below too (the bottom one lies in a slot of the belt): all four flats in one pass, no roll',
     4, [(IDLE, 0, 0, 'Idle'), (CUT, 0, 4, 'The pass: four flats at once'), (DONE, 0, 4, 'Done: square log')]),
    ('B', 'Level 1: one blade, four passes', 'the plank saw\'s blade: a flat plate with big teeth that slides back and forth across the trunk, both ends always inside a post (dark slot); it planes the top flat, then the trunk rolls',
     1, [(IDLE, 0, 0, 'Idle'), (CUT, 0, 1, 'Pass 1: top flat'), (ROLL, 0, 1, 'Back, rolls itself'), (CUT, 3, 4, 'Pass 4: last flat'), (DONE, 3, 4, 'Done: square log')]),
    ('B', 'Level 25: two blades, two passes', 'a second horizontal blade skims the belt under the trunk and takes the bottom flat in the same pass',
     2, [(IDLE, 0, 0, 'Idle'), (CUT, 0, 2, 'Pass 1: top and bottom flat'), (ROLL, 0, 2, 'Back, rolls itself'), (CUT, 1, 4, 'Pass 2: the other two'), (DONE, 1, 4, 'Done: square log')]),
    ('B', 'Level 50: four blades, one pass', 'two vertical blades stand a little further down the line inside the same (wider) portal, in the planes of the far and near flats and slide up and down (lower end in a slit of the belt, upper end in the beam): all four flats in one pass, no roll',
     4, [(IDLE, 0, 0, 'Idle'), (CUT, 0, 4, 'The pass: blades up'), (CUT, 0, 4, 'The pass: blades down'), (DONE, 0, 4, 'Done: square log')]),
]
NOTES = [
    'A, circular discs (as in the game now): the disc is already drawn and the logic is done. The near and top discs have to be half transparent, or they hide the trunk. The bottom disc is only a rim in the belt.',
    'B, flat blades: one look for both saws, nothing is hidden by a spinning blur, the blades are thin lines that slide. Costs: new drawing for the vertical blades, posts and beam around the trunk (it passes between the posts, like at the plank saw).',
    'Both: the trunk moves at the conveyors\' speed, 1 / 2 / 4 tools at levels 1 / 25 / 50 make 4 / 2 / 1 passes (6.9 s, 2.8 s and 0.8 s per trunk). Slabs lie behind the saw. Nothing in the game changes until one is approved.',
]

W = 2180
ROW_H = 400
H = 80 + len(ROWS) * ROW_H + 40 + len(NOTES) * 30
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" style="width:100%;height:auto;max-width:{W}px">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the log saw (row 1) by level: 1, 25 and 50, with circular discs (A) or flat sliding blades (B)', 28)
for r, (ver, name, sub, n, frames) in enumerate(ROWS):
    top = 70 + r * ROW_H
    label(30, top + 24, f'{ver} · {name}', 24, 'start')
    label(30, top + 48, sub, 16, 'start', 400)
    for c, (kind, pass_, k, title) in enumerate(frames):
        ox, oy = c * 430 + 190, top + 215
        sw = (-STROKE if c % 2 else STROKE) if kind == CUT else 0.0
        if ver == 'A':
            machine_a(ox, oy, n, kind, pass_, k if kind != IDLE else 0, 0.5 * (c + 1))
        else:
            machine_b(ox, oy, n, kind, pass_, k if kind != IDLE else 0, sw if title.endswith('down') is False else STROKE)
        label(ox + 120, top + 380, title, 20, weight=700)
for i, note in enumerate(NOTES):
    label(30, 70 + len(ROWS) * ROW_H + 30 + i * 30, note, 17, 'start', 400)
out.append('</svg>')
print('\n'.join(out))
