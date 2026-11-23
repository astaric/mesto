#!/usr/bin/env python3
"""Generates idle-plank-saw2-sample.svg: second round for the plank saw (saw 2, row 2): the band saw (closest in round 1) refined, and two panel saws. The machine grows with its level: level 1 one blade (one plank per pass), level 25 two blades, level 50 three blades (all four planks at once).
Run: python3 docs/minigames/idle-plank-saw2-sample.py > docs/minigames/idle-plank-saw2-sample.svg
Reuses the helpers of idle-plank-saw-sample.py (everything before its variant A). Each row: idle, working at level 1 / 25 / 50, done."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-plank-saw-sample.py')).read()
exec(src[:src.index('\n# ---------- A: gang')])


def band_loop(z, ox, oy, f, bx=1.9, y0=0.45, y1=1.95, r=0.38):
    poly(hull(xy_ring(bx, y0, z, r, ox, oy) + xy_ring(bx, y1, z, r, ox, oy)), shade(BLUE, 0.98), 1.6)
    poly(xy_ring(bx, y0, z, r * 0.78, ox, oy, 24), STEEL_L, 1.3)
    poly(xy_ring(bx, y1, z, r * 0.78, ox, oy, 24), STEEL_L, 1.3)
    line(P(bx - r, y0, z, ox, oy), P(bx - r, y1, z, ox, oy), STEEL_D, 4)
    for k in range(16):
        yy = y0 + ((k + (f or 0) * 0.33) % 16) / 16 * (y1 - y0)
        line(P(bx - r, yy, z, ox, oy), P(bx - r - 0.07, yy, z, ox, oy), STEEL_L, 1.6)


def layers(ox, oy, x0, l, cuts):
    """The square log [x0, x0+l] lying still as four layers; the layers above each cut are lifted a little."""
    for i in range(4):
        lift = sum(1 for j in cuts if j < i) * 0.04
        block(x0, CY - D / 2, CHB + i * BH + lift, ox, oy, MEDIUM, 1, l, D, BH)


def boards_out(ox, oy):
    for i in range(4):
        block(3.0, CY - D / 2, CHB + i * (BH + 0.025), ox, oy, MEDIUM, 1, 2.0, D, BH)


# ---------- C1: band-saw tower, round 1: one flat band loop per blade ----------
def alt_c1(ox, oy, f, xs, cuts):
    conveyor(ox, oy)
    block(1.5, 0.0, 0, ox, oy, STEEL_D, 1, 0.9, 0.4, 0.15)
    cant_parts(ox, oy, xs, 1.52, 2.45)
    for j in cuts:
        band_loop(blade_z(j), ox, oy, f)
    block(1.5, 2.1, 0, ox, oy, STEEL_D, 1, 0.9, 0.4, 0.15)
    for yy in (0.2, 2.2):
        block(1.8, yy, 0.15, ox, oy, BLUE, 1, 0.14, 0.14, 1.9)
    block(1.5, 0.15, 2.05, ox, oy, shade(BLUE, 0.9), 1, 0.9, 2.2, 0.15)
    heap(ox, oy, 2.7, 2.3, 6)
    if f is not None:
        dust(ox, oy, [(2.0, 0.55, 0.7, 0.2), (2.0, 1.9, 0.7, 0.2)], 110 + f, 3)


# ---------- C2: the same, wheels hidden in two blue cabinets; only the blades cross the belt ----------
def alt_c2(ox, oy, f, xs, cuts):
    conveyor(ox, oy)
    block(1.4, 0.0, 0, ox, oy, BLUE, 1, 1.0, 0.75, 2.0)
    block(1.4, 0.0, 2.0, ox, oy, shade(BLUE, 0.9), 1, 1.0, 0.75, 0.15)
    cant_parts(ox, oy, xs, 1.45, 2.4)
    for j in cuts:
        z = blade_z(j)
        line(P(1.45, 0.75, z, ox, oy), P(1.45, 1.65, z, ox, oy), STEEL_D, 4.5)
        for k in range(10):
            yy = 0.75 + ((k + (f or 0) * 0.4) % 10) / 10 * 0.9
            line(P(1.45, yy, z, ox, oy), P(1.45 - 0.07, yy, z, ox, oy), STEEL_L, 1.6)
    block(1.4, 1.65, 0, ox, oy, BLUE, 1, 1.0, 0.85, 2.0)
    block(1.4, 1.65, 2.0, ox, oy, shade(BLUE, 0.9), 1, 1.0, 0.85, 0.15)
    c = P(2.4, 2.07, 1.0, ox, oy)
    out.append(f'<ellipse cx="{c[0]:.1f}" cy="{c[1]:.1f}" rx="14" ry="30" fill="{STEEL_L}" stroke="{INK}" stroke-width="1.6"/>')
    heap(ox, oy, 2.75, 2.2, 6)
    if f is not None:
        dust(ox, oy, [(1.6, 0.9, 0.7, 0.2), (1.6, 1.5, 0.7, 0.2), (2.4, 2.0, 0.2, 0.2)], 130 + f, 3)


def mast_discs(ox, oy, cx, y, cuts, phase, ztop):
    """A mast hanging from `ztop` with one flat disc per cut."""
    lo = blade_z(min(cuts))
    block(cx - 0.06, y - 0.06, lo + 0.04, ox, oy, STEEL_D, 1, 0.12, 0.12, ztop - lo - 0.04)
    for j in cuts:
        flat_disc(cx, y, blade_z(j), 0.62, ox, oy, phase + j * 0.1)


# ---------- P1: rail panel saw: the square log lies still, a bridge rolls along two rails over it; the mast carries 1 / 2 / 3 discs ----------
def alt_p1(ox, oy, f, xs, cuts):
    conveyor(ox, oy)
    X0, X1, RZ = 0.6, 3.5, 1.7
    for x in (X0, X1 - 0.12):
        block(x, 0.0, 0, ox, oy, STEEL_D, 1, 0.12, 0.12, RZ)
    block(X0, 0.0, RZ, ox, oy, BLUE, 1, X1 - X0, 0.14, 0.14)
    working = f is not None
    if working:
        layers(ox, oy, 0.9, 2.0, cuts)
    elif xs is None:
        layers(ox, oy, 0.9, 2.0, [])
    else:
        boards_out(ox, oy)
    cx = 1.9 if working else 0.75
    block(cx - 0.12, 0.0, RZ - 0.1, ox, oy, ORANGE, 1, 0.3, 2.5, 0.12)
    if working:
        mast_discs(ox, oy, cx, 0.9, cuts, PH(f, 0.35), RZ - 0.1)
        dust(ox, oy, [(cx + 0.4, 1.2, 0.9, 0.2), (cx + 0.6, 1.0, 0.7, 0.15)], 140 + f, 4)
    else:
        block(cx - 0.06, 0.4, RZ - 0.45, ox, oy, STEEL_D, 1, 0.12, 0.12, 0.35)
    block(X0, 2.4, RZ, ox, oy, BLUE, 1, X1 - X0, 0.14, 0.14)
    for x in (X0, X1 - 0.12):
        block(x, 2.4, 0, ox, oy, STEEL_D, 1, 0.12, 0.12, RZ)
    heap(ox, oy, 3.0, 2.8, 5)


# ---------- P2: upright panel saw: a gate over the belt, the saw head slides along its cross beam; the mast carries 1 / 2 / 3 discs; the log is fed through step by step ----------
def alt_p2(ox, oy, f, xs, cuts):
    conveyor(ox, oy)
    FX, BZ = 1.5, 2.05
    block(FX, 0.0, 0, ox, oy, BLUE, 1, 0.3, 0.3, 2.2)
    cant_parts(ox, oy, xs, FX, FX + 0.3)
    block(FX, 0.0, BZ, ox, oy, shade(BLUE, 0.9), 1, 0.3, 2.5, 0.16)
    working = f is not None
    hy = (0.6, 1.4, 0.9)[f] if working else 0.4
    block(FX + 0.05, hy, BZ - 0.2, ox, oy, ORANGE, 1, 0.2, 0.4, 0.25)
    if working:
        mast_discs(ox, oy, FX + 0.15, hy + 0.2, cuts, PH(f, 0.4), BZ - 0.2)
        dust(ox, oy, [(FX + 0.5, hy + 0.2, 0.8, 0.2), (FX + 0.4, hy + 0.4, 0.7, 0.15)], 150 + f, 4)
    block(FX, 2.2, 0, ox, oy, BLUE, 1, 0.3, 0.3, 2.2)
    block(FX, 2.2, 2.2, ox, oy, shade(BLUE, 0.85), 1, 0.3, 0.3, 0.1)
    heap(ox, oy, 2.8, 2.3, 6)


# (name, sub, drawing, [idle, level 1, level 25, level 50, done]: (f, xs, cuts))
FR = [(None, None, [2]), (0, 1.8, [2]), (1, 1.8, [0, 2]), (2, 1.8, [0, 1, 2]), (None, 3.0, [0, 1, 2])]
FR_STILL = [(None, None, [2]), (0, 1.8, [2]), (1, 1.8, [0, 2]), (2, 1.8, [0, 1, 2]), (None, 3.0, [0, 1, 2])]
COLS2 = ['Idle', 'Level 1: 1 blade', 'Level 25: 2 blades', 'Level 50: 3 blades', 'Done: 4 planks']
ALTS = [
    ('C1  Band-saw tower, open (round 1)', 'one flat band loop per blade; more loops appear as the saw levels up', alt_c1),
    ('C2  Band-saw tower in cabinets', 'the wheels are hidden in two blue cabinets, only the toothed blades cross the belt; level 1 one blade, 25 two, 50 three', alt_c2),
    ('P1  Rail panel saw', 'the square log lies still; an orange bridge rolls along two rails over it, its mast carries 1, 2 or 3 flat discs; the cut layers lift apart (4 passes, 2 passes, 1 pass)', alt_p1),
    ('P2  Upright panel saw', 'a gate over the belt; the saw head slides along its cross beam, its mast carries 1, 2 or 3 flat discs; the log is fed through step by step', alt_p2),
]

W, H = 2180, 1690
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the plank saw (row 2), round 2: band saw and panel saw, by level', 28)
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
