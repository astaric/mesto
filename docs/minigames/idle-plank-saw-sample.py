#!/usr/bin/env python3
"""Generates idle-plank-saw-sample.svg: four proposals for the plank saw (saw 2, row 2: a square log, the "cant", goes in, four rough planks come out).
Run: python3 docs/minigames/idle-plank-saw-sample.py > docs/minigames/idle-plank-saw-sample.svg
Reuses the helpers of idle-logsaw-sample.py (everything before its variant A). Each row: idle, three frames of work, done. Nothing in the game changes until one is approved."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-logsaw-sample.py')).read()
exec(src[:src.index('# ---------- A:')])

CHB = 0.5          # belt height
BH = D / 4         # one board's thickness
ORANGE = '#d9814f'


def cant_parts(ox, oy, xs, x_in, x_out, gap=0.025):
    """The cant [xs, xs+2] on the belt: one block before the machine's mouth `x_in`, four separate boards after its exit `x_out` (the part inside is hidden)."""
    if xs is None:
        return
    a, b = xs, xs + 2.0
    if min(b, x_in) - a > 0.06:
        block(a, CY - D / 2, CHB, ox, oy, MEDIUM, 1, min(b, x_in) - a)
    if b - max(a, x_out) > 0.06:
        for i in range(4):
            block(max(a, x_out), CY - D / 2, CHB + i * (BH + gap), ox, oy, MEDIUM, 1, b - max(a, x_out), D, BH)


def xy_ring(cx, cy, z, r, ox, oy, n=36):
    return [P(cx + r * math.cos(i * 2 * math.pi / n), cy + r * math.sin(i * 2 * math.pi / n), z, ox, oy) for i in range(n)]


def flat_disc(cx, cy, z, r, ox, oy, phase, teeth=18, color=STEEL_L):
    """A toothed disc lying flat (horizontal): the blade of a saw that cuts the cant into layers."""
    pts = [P(cx + (r if i % 2 == 0 else r * 0.85) * math.cos(phase + i * math.pi / teeth), cy + (r if i % 2 == 0 else r * 0.85) * math.sin(phase + i * math.pi / teeth), z, ox, oy) for i in range(teeth * 2)]
    poly(pts, color, 1.5)
    poly(xy_ring(cx, cy, z, r * 0.22, ox, oy, 14), STEEL_D, 1.2)


def blade_z(i):
    """The three cuts of a four-board cant: heights of the blades."""
    return CHB + BH * (i + 1)


# ---------- A: gang saw, a boxed frame with three stacked blades that saw back and forth ----------
def alt_a(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.1, 0.0, 0, ox, oy, BLUE, 1, 1.5, 0.75, 1.9)                       # far wall
    for i in range(3):                                                        # the three blades show on the exit face, shifted while they saw
        sh = (0.07 if (f or 0) % 2 else -0.07) if f is not None else 0
        z = blade_z(i)
        a, b = P(2.6 + sh, 0.75, z, ox, oy), P(2.6 + sh, 1.65, z, ox, oy)
        line(a, b, STEEL_L, 3.4)
        for k in range(9):
            t = k / 8
            line(P(2.6 + sh, 0.75 + 0.9 * t, z, ox, oy), P(2.6 + sh, 0.75 + 0.9 * t, z - 0.045, ox, oy), STEEL_D, 1.4)
    cant_parts(ox, oy, xs, 1.1, 2.6)
    block(1.1, 1.65, 0, ox, oy, BLUE, 1, 1.5, 0.85, 1.9)                      # near wall
    block(1.1, 0.0, 1.35, ox, oy, shade(BLUE, 0.92), 1, 1.5, 2.5, 0.55)       # head over the mouth
    for yy in (0.3, 2.0):                                                     # two rods, up to the crank on top
        block(1.75, yy, 1.9, ox, oy, STEEL_D, 1, 0.12, 0.12, 0.6)
    block(1.45, 0.05, 2.5, ox, oy, STEEL_D, 1, 0.9, 2.4, 0.12)
    flat_disc(1.9, 1.25, 2.65, 0.45, ox, oy, PH(f, 0.9), 6, ORANGE)
    heap(ox, oy, 2.7, 2.2, 6)
    if f is not None:
        dust(ox, oy, [(2.7, 0.9, 0.6, 0.2), (2.7, 1.5, 0.8, 0.2), (2.4, 2.1, 0.2, 0.2)], 90 + f, 4)


# ---------- B: the plate stack, a pillar with three flat discs sticking out over the lane ----------
def alt_b(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.3, 0.1, 0, ox, oy, STEEL_D, 1, 0.9, 0.9, 0.2)                     # base of the pillar, far side
    block(1.55, 0.35, 0.2, ox, oy, BLUE, 1, 0.4, 0.4, 2.1)                    # the pillar
    for i in range(3):
        z = blade_z(i)
        block(1.62, 0.5, z - 0.05, ox, oy, STEEL_D, 1, 0.26, 0.5, 0.1)        # arm to the disc
    for i in range(3):
        flat_disc(1.75, 1.2 if False else 1.0, blade_z(i), 0.55, ox, oy, PH(f, 0.35) + i * 0.1)
    cant_parts(ox, oy, xs, 1.2, 2.45)
    block(1.45, 2.0, 0, ox, oy, STEEL_D, 1, 0.6, 0.6, 0.2)
    block(1.55, 2.1, 0.2, ox, oy, shade(BLUE, 0.9), 1, 0.4, 0.4, 1.6)         # a second, shorter support on the near side
    block(1.4, 2.0, 1.8, ox, oy, shade(ORANGE, 1.0), 1, 0.7, 0.55, 0.4)       # motor
    heap(ox, oy, 2.6, 2.2, 6)
    if f is not None:
        dust(ox, oy, [(2.35, 0.8, 0.6, 0.2), (2.3, 1.7, 0.9, 0.2)], 100 + f, 4)


# ---------- C: band saw tower, three horizontal band loops stacked, each on two big wheels ----------
def band_loop(z, ox, oy, f, bx=1.9):
    y0, y1 = 0.45, 1.95
    r = 0.38
    poly(hull(xy_ring(bx, y0, z, r, ox, oy) + xy_ring(bx, y1, z, r, ox, oy)), shade(BLUE, 0.98), 1.6)
    poly(xy_ring(bx, y0, z, r * 0.78, ox, oy, 24), STEEL_L, 1.3)
    poly(xy_ring(bx, y1, z, r * 0.78, ox, oy, 24), STEEL_L, 1.3)
    line(P(bx - r, y0, z, ox, oy), P(bx - r, y1, z, ox, oy), STEEL_D, 4)      # the blade runs along the front of the loop
    for k in range(16):
        yy = y0 + ((k + (f or 0) * 0.33) % 16) / 16 * (y1 - y0)
        line(P(bx - r, yy, z, ox, oy), P(bx - r - 0.07, yy, z, ox, oy), STEEL_L, 1.6)


def alt_c(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.5, 0.0, 0, ox, oy, STEEL_D, 1, 0.9, 0.4, 0.15)                    # foot, far
    cant_parts(ox, oy, xs, 1.52, 2.45)
    for i in range(3):                                                        # three loops: a blade at each cutting height
        band_loop(blade_z(i) + 0.0, ox, oy, f)
    block(1.5, 2.1, 0, ox, oy, STEEL_D, 1, 0.9, 0.4, 0.15)                    # foot, near
    for yy in (0.2, 2.2):
        block(1.8, yy, 0.15, ox, oy, BLUE, 1, 0.14, 0.14, 1.9)                # two posts that hold the loops
    block(1.5, 0.15, 2.05, ox, oy, shade(BLUE, 0.9), 1, 0.9, 2.2, 0.15)
    heap(ox, oy, 2.7, 2.3, 6)
    if f is not None:
        dust(ox, oy, [(2.0, 0.55, 0.7, 0.2), (2.0, 1.9, 0.7, 0.2)], 110 + f, 3)


# ---------- D: one blade, one board at a time: the cant is sliced from the top three times, each board lifts off to a side rack ----------
def alt_d(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.4, 0.1, 0, ox, oy, BLUE, 1, 1.0, 0.5, 1.5)                        # frame, far side
    flat_disc(1.9, 1.35, CHB + D * 0.75, 0.62, ox, oy, PH(f, 0.35))
    cant_parts(ox, oy, xs, 1.4, 2.4)
    block(1.4, 1.95, 0, ox, oy, BLUE, 1, 1.0, 0.5, 1.5)                       # frame, near side
    block(1.4, 0.1, 1.5, ox, oy, shade(BLUE, 0.9), 1, 1.0, 2.35, 0.2)         # hood
    block(1.4, 2.6, 0, ox, oy, STEEL_D, 1, 1.4, 0.8, 0.45)                    # the rack beside the machine, boards that were cut wait there
    for i in range(min(3, (f or 0) + 1) if f is not None else 0):
        block(1.5, 2.65, 0.45 + i * (BH + 0.02), ox, oy, MEDIUM, 1, 1.2, D, BH)
    if f is not None:
        dust(ox, oy, [(2.0, 1.0, 0.9, 0.2), (2.3, 1.9, 0.5, 0.2)], 120 + f, 4)


ALTS = [
    ('A  Gang saw', 'a boxed frame; three blades stacked over each other saw back and forth (they shift between frames), a crank wheel on top; the cant goes in as one block, four boards come out', alt_a, [None, -0.4, 0.8, 1.8, 3.0]),
    ('B  Plate stack', 'a pillar with three big flat discs sticking out over the lane like a stack of plates; the cant is pushed between them and splits into four boards', alt_b, [None, -0.4, 0.8, 1.8, 3.0]),
    ('C  Band-saw tower', 'three flat band loops on big wheels, one above the other, each blade at a cutting height; the teeth run along the blade; the most "real sawmill" look', alt_c, [None, -0.4, 0.8, 1.8, 3.0]),
    ('D  One blade, one board at a time', 'the sibling of the log saw: one big flat disc, the cant slides through; boards pile up on a rack by the machine', alt_d, [None, -0.4, 0.8, 1.8, 3.0]),
]

W, H = 2180, 1690
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the plank saw (row 2), four ideas (idle, three frames of work in a loop, done)', 28)
for r, (name, sub, fn, xss) in enumerate(ALTS):
    top = 70 + r * 400
    label(30, top + 24, name, 24, 'start')
    label(30, top + 48, sub, 16, 'start', 400)
    for c in range(5):
        ox, oy = c * 430 + 190, top + 215
        fn(ox, oy, None if c in (0, 4) else c - 1, xss[c] if c else None)
        label(ox + 120, top + 380, COLS[c], 20, weight=700)
out.append('</svg>')
print('\n'.join(out))
