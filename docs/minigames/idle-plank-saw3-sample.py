#!/usr/bin/env python3
"""Generates idle-plank-saw3-sample.svg: round 3 for the plank saw (saw 2, row 2): the open band-saw tower with a plain RECTANGULAR blade that slides left and right
instead of a band loop. Level 1: 1 blade, level 25: 2 blades, level 50: 3 blades (all four planks at once).
Run: python3 docs/minigames/idle-plank-saw3-sample.py > docs/minigames/idle-plank-saw3-sample.svg
Reuses the helpers of idle-plank-saw2-sample.py (everything before its variant C1)."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-plank-saw2-sample.py')).read()
exec(src[:src.index('\n# ---------- C1:')])

BX = 1.65           # the blades' cutting edge (x)
BW, BT = 0.3, 0.04  # plate width along x, thickness


def plate(ox, oy, ya, yb, z, bx=BX, teeth=True):
    """A flat rectangular blade lying across the belt from y=ya to y=yb at height z, its toothed edge towards the incoming log (-x)."""
    if yb - ya < 0.05:
        return
    block(bx, ya, z, ox, oy, STEEL_L, 1, BW, yb - ya, BT)
    if teeth:
        n = max(2, int((yb - ya) / 0.07))
        for k in range(n + 1):
            y = ya + (yb - ya) * k / n
            line(P(bx, y, z + BT, ox, oy), P(bx + 0.08, y, z + BT, ox, oy), STEEL_D, 1.5)


FR = [(None, None, [2]), (0, 1.8, [2]), (1, 1.8, [0, 2]), (2, 1.8, [0, 1, 2]), (None, 3.0, [0, 1, 2])]   # idle, level 1, 25, 50, done: (phase, log x, blade heights)
COLS2 = ['Idle', 'Level 1: 1 blade', 'Level 25: 2 blades', 'Level 50: 3 blades', 'Done: 4 planks']
SHIFT = {None: 0.0, 0: -0.22, 1: 0.0, 2: 0.22}


# ---------- R1: the open frame of the tower, the blades are plain plates sliding in the two posts ----------
def alt_r1(ox, oy, f, xs, cuts):
    conveyor(ox, oy)
    block(BX - 0.1, 0.0, 0, ox, oy, BLUE, 1, 0.5, 0.35, 2.0)                   # far post (the guide)
    cant_parts(ox, oy, xs, BX - 0.05, BX + 0.3)
    s = SHIFT[f]
    for j in cuts:
        plate(ox, oy, 0.6 + s, 1.9 + s, blade_z(j))
    block(BX - 0.1, 2.2, 0, ox, oy, BLUE, 1, 0.5, 0.35, 2.0)                   # near post
    block(BX - 0.1, 0.0, 2.0, ox, oy, shade(BLUE, 0.9), 1, 0.5, 2.55, 0.14)    # cross beam
    heap(ox, oy, 2.7, 2.3, 6)
    if f is not None:
        dust(ox, oy, [(BX + 0.35, 1.0 + s, 0.7, 0.2), (BX + 0.35, 1.5 + s, 0.7, 0.2)], 160 + f, 3)


# ---------- R2: a sash: the blades are held by two orange end bars, the whole frame slides sideways between two posts ----------
def alt_r2(ox, oy, f, xs, cuts):
    conveyor(ox, oy)
    s = SHIFT[f]
    zlo, zhi = blade_z(min(cuts)) - 0.12, blade_z(max(cuts)) + 0.2
    block(BX - 0.1, 0.0, 0, ox, oy, BLUE, 1, 0.5, 0.3, 2.0)                    # far post
    block(BX - 0.05, 0.62 + s, zlo, ox, oy, ORANGE, 1, 0.4, 0.12, zhi - zlo)   # far bar of the sash
    cant_parts(ox, oy, xs, BX - 0.05, BX + 0.3)
    for j in cuts:
        plate(ox, oy, 0.74 + s, 1.86 + s, blade_z(j))
    block(BX - 0.05, 1.86 + s, zlo, ox, oy, ORANGE, 1, 0.4, 0.12, zhi - zlo)   # near bar
    block(BX - 0.1, 2.25, 0, ox, oy, BLUE, 1, 0.5, 0.3, 2.0)                   # near post
    block(BX - 0.1, 0.0, 2.0, ox, oy, shade(BLUE, 0.9), 1, 0.5, 2.55, 0.14)
    heap(ox, oy, 2.7, 2.3, 6)
    if f is not None:
        dust(ox, oy, [(BX + 0.35, 1.0 + s, 0.7, 0.2), (BX + 0.35, 1.5 + s, 0.7, 0.2)], 170 + f, 3)


# ---------- R3: the cabinets of round 2: the blades slide out of one cabinet across the belt and back, a slot in each cabinet ----------
def alt_r3(ox, oy, f, xs, cuts):
    conveyor(ox, oy)
    block(BX - 0.25, 0.0, 0, ox, oy, BLUE, 1, 0.8, 0.75, 2.0)
    block(BX - 0.25, 0.0, 2.0, ox, oy, shade(BLUE, 0.9), 1, 0.8, 0.75, 0.15)
    cant_parts(ox, oy, xs, BX - 0.05, BX + 0.3)
    a = (0.45, 0.65, 0.85)[f] if f is not None else 0.45                         # the blade's start; it shows between the cabinets only
    lo, hi = 0.75, 1.65
    for j in cuts:
        plate(ox, oy, max(lo, a), min(hi, a + 1.0), blade_z(j))
    block(BX - 0.25, 1.65, 0, ox, oy, BLUE, 1, 0.8, 0.85, 2.0)
    block(BX - 0.25, 1.65, 2.0, ox, oy, shade(BLUE, 0.9), 1, 0.8, 0.85, 0.15)
    for j in cuts:                                                             # a dark slot on each cabinet face the blade goes into
        for yy in (0.75, 1.65):
            z = blade_z(j)
            poly([P(BX - 0.25, yy, z + 0.04, ox, oy), P(BX + 0.55, yy, z + 0.04, ox, oy), P(BX + 0.55, yy, z - 0.01, ox, oy), P(BX - 0.25, yy, z - 0.01, ox, oy)], '#2b2b2b', 0.8) if yy == 1.65 else None
    heap(ox, oy, 2.75, 2.2, 6)
    if f is not None:
        dust(ox, oy, [(BX + 0.35, 1.0, 0.7, 0.2), (BX + 0.35, 1.4, 0.7, 0.2)], 180 + f, 3)


ALTS = [
    ('R1  Plates in an open frame', 'the open tower of round 1, but each blade is a plain rectangular plate with a toothed edge that slides left and right through two blue posts; 1, 2 or 3 plates by level', alt_r1),
    ('R2  Sash', 'the plates are held by two orange end bars; the whole sash slides sideways between the posts like a frame saw lying on its side, so the blades visibly belong together', alt_r2),
    ('R3  Plates sliding out of cabinets', 'the blades come out of one blue cabinet and back, only the part between the cabinets shows; the fewest details of all', alt_r3),
]

W, H = 2180, 1290
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the plank saw (row 2), round 3: rectangular blades sliding left and right, by level', 28)
for r, (name, sub, fn) in enumerate(ALTS):
    top = 70 + r * 400
    label(30, top + 24, name, 24, 'start')
    label(30, top + 48, sub, 16, 'start', 400)
    for c in range(5):
        ox, oy = c * 430 + 190, top + 215
        f, xs, cuts = FR[c]
        fn(ox, oy, f, xs, cuts)
        label(ox + 120, top + 380, COLS2[c], 20, weight=700)
out.append('</svg>')
print('\n'.join(out))
