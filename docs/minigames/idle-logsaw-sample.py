#!/usr/bin/env python3
"""Generates idle-logsaw-sample.svg: four proposals for the log saw (row 1: a peeled trunk goes in round, a square log, the "cant", comes out).
Run: python3 docs/minigames/idle-logsaw-sample.py > docs/minigames/idle-logsaw-sample.svg
Reuses the drawing helpers of idle-pieces-sample.py. The flow runs along +x (down-right); each column is idle, three frames of work, done."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-pieces-sample.py')).read()
exec(src[:src.index('W, H =')])
U = 44

STEEL, STEEL_D, STEEL_L = '#7d8791', '#4f5963', '#dfe4e8'
BLUE = '#7f9fc2'       # the saw's colour in the game today
DUST = '#f1d27a'
CY = 1.2
COLS = ['Idle', 'Working 1', 'Working 2', 'Working 3', 'Done']


def conveyor(ox, oy, ch=0.5):
    block(-1.4, CY - 0.4, 0, ox, oy, STEEL, 1, 6.4, 0.8, ch)
    for x in [i * 0.4 - 1.2 for i in range(16)]:
        line(P(x, CY - 0.4, ch, ox, oy), P(x, CY + 0.4, ch, ox, oy), shade(STEEL, 0.7), 1.2)


def trunk_parts(ox, oy, xs, x_in, x_out, ch=0.5):
    """A peeled trunk [xs, xs+2] on the belt: round before the machine's mouth `x_in`, square after its exit `x_out`; the part inside is hidden."""
    if xs is None:
        return
    a, b = xs, xs + 2.0
    if min(b, x_in) - a > 0.06:
        cylinder(a, CY - D / 2, ch, ox, oy, MEDIUM, True, min(b, x_in) - a)
    if b - max(a, x_out) > 0.06:
        block(max(a, x_out), CY - D / 2, ch, ox, oy, MEDIUM, 1, b - max(a, x_out))


def xz_ring(y, cx, cz, r, ox, oy, n=36):
    return [P(cx + r * math.cos(i * 2 * math.pi / n), y, cz + r * math.sin(i * 2 * math.pi / n), ox, oy) for i in range(n)]


def toothed(y, cx, cz, r, ox, oy, phase, teeth=16, color=STEEL_L):
    pts = []
    for i in range(teeth * 2):
        a = phase + i * math.pi / teeth
        rr = r if i % 2 == 0 else r * 0.84
        pts.append(P(cx + rr * math.cos(a), y, cz + rr * math.sin(a), ox, oy))
    poly(pts, color, 1.6)
    poly(xz_ring(y, cx, cz, r * 0.3, ox, oy, 16), STEEL_D, 1.4)


def dust(ox, oy, spots, seed, n=5, col=DUST):
    rnd = random.Random(seed)
    for (x, y, z, s) in spots:
        for _ in range(n):
            block(x + rnd.uniform(-s, s), y + rnd.uniform(-s, s), max(0.02, z + rnd.uniform(-s, s)), ox, oy, col, 1, 0.1, 0.08, 0.06)


def heap(ox, oy, x, y, n=6, col=DUST):
    for i in range(n):
        block(x + (i % 3) * 0.15, y + (i // 3) * 0.13, (i // 3) * 0.07, ox, oy, col if i % 2 else shade(col, 0.85), 1, 0.2, 0.16, 0.08)


PH = lambda f, step: (f % 4) * step if f is not None else 0


# ---------- A: chipper-canter, a tunnel with cutter heads on its sides; chips fall into a bin ----------
def alt_a(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.1, 0.1, 0, ox, oy, BLUE, 1, 1.5, 0.6, 1.35)                       # far wall
    trunk_parts(ox, oy, xs, 1.1, 2.6)
    block(1.1, 1.9, 0, ox, oy, BLUE, 1, 1.5, 0.6, 1.35)                       # near wall
    block(1.1, 0.1, 1.35, ox, oy, shade(BLUE, 0.9), 1, 1.5, 2.4, 0.2)         # bridge over the lane
    block(1.55, 2.6, 0, ox, oy, STEEL_D, 1, 0.9, 0.6, 0.55)                   # chip bin
    heap(ox, oy, 1.65, 2.62, 5, '#e0b872')
    cx, cz, y = 1.85, 0.8, 2.52
    poly(xz_ring(y, cx, cz, 0.5, ox, oy), '#d9814f')                          # the cutter head on the near wall
    toothed(y, cx, cz, 0.44, ox, oy, PH(f, 0.5), 5, shade('#d9814f', 1.15))
    if f is not None:
        dust(ox, oy, [(1.9, 2.7, 0.9, 0.25), (1.8, 2.8, 0.55, 0.15)], 40 + f, 4, '#e0b872')


# ---------- B: twin circular saws on an open gantry ----------
def alt_b(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.5, 0.15, 0, ox, oy, STEEL_D, 1, 0.3, 0.3, 2.1)                    # far post
    toothed(0.55, 1.95, 1.35, 0.75, ox, oy, PH(f, 0.35), 18)                  # far disc
    block(1.0, 0.15, 2.1, ox, oy, BLUE, 1, 1.8, 0.3, 0.25)                    # beam, far
    trunk_parts(ox, oy, xs, 1.8, 2.1)
    toothed(1.9, 1.95, 1.35, 0.75, ox, oy, PH(f, 0.35) + 0.2, 18)             # near disc
    block(1.0, 1.95, 2.1, ox, oy, BLUE, 1, 1.8, 0.3, 0.25)                    # beam, near
    block(1.5, 2.2, 0, ox, oy, STEEL_D, 1, 0.3, 0.3, 2.1)                     # near post
    block(1.8, 2.1, 1.1, ox, oy, '#d9814f', 1, 0.3, 0.3, 0.5)                 # motor boxes
    block(1.8, 0.0, 1.1, ox, oy, '#d9814f', 1, 0.3, 0.3, 0.5)
    heap(ox, oy, 2.3, 2.3, 6)
    if f is not None:
        dust(ox, oy, [(2.2, 0.8, 0.7, 0.2), (2.4, 1.7, 0.7, 0.2), (2.3, 2.1, 0.3, 0.2)], 50 + f, 4)


# ---------- C: twin band saws, tall vertical blades either side of the lane ----------
def band(y, ox, oy, f, bx=1.9, zt=2.2, zb=0.3, r=0.3):
    poly(hull(xz_ring(y, bx, zt, r, ox, oy) + xz_ring(y, bx, zb, r, ox, oy)), shade(BLUE, 0.95))
    poly(xz_ring(y, bx, zt, r * 0.7, ox, oy, 24), STEEL_L, 1.4)
    poly(xz_ring(y, bx, zb, r * 0.7, ox, oy, 24), STEEL_L, 1.4)
    a, b = P(bx - r, y, zt, ox, oy), P(bx - r, y, zb, ox, oy)
    line(a, b, STEEL_D, 5)
    for i in range(14):                                                        # the blade's teeth run down the edge
        z = zb + ((i + (f or 0) * 0.25) % 14) / 14 * (zt - zb)
        line(P(bx - r, y, z, ox, oy), P(bx - r - 0.08, y, z - 0.05, ox, oy), STEEL_L, 1.8)
    for z in (zt, zb):
        c = P(bx, y, z, ox, oy)
        out.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="4" fill="{STEEL_D}"/>')


def alt_c(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.0, 0.1, 0, ox, oy, STEEL_D, 1, 1.8, 0.35, 0.2)                    # foot, far
    band(0.35, ox, oy, f)
    trunk_parts(ox, oy, xs, 1.55, 1.95)
    block(1.0, 2.0, 0, ox, oy, STEEL_D, 1, 1.8, 0.35, 0.2)                    # foot, near
    band(2.1, ox, oy, f)
    heap(ox, oy, 2.5, 2.4, 6)
    if f is not None:
        dust(ox, oy, [(1.7, 0.8, 0.6, 0.2), (1.7, 1.75, 0.6, 0.2), (2.3, 2.2, 0.2, 0.2)], 60 + f, 3)


# ---------- D: the square-hole box, the sibling of the round-hole debarker ring ----------
def alt_d(ox, oy, f, xs):
    conveyor(ox, oy)
    block(1.3, 0.1, 0, ox, oy, STEEL_D, 1, 1.4, 2.2, 0.25)                    # base
    block(1.5, 0.3, 0.25, ox, oy, BLUE, 1, 1.0, 1.8, 1.45)                    # the box
    x1 = 2.5
    hy0, hy1, hz0, hz1 = 0.95, 1.45, 0.5, 1.0
    poly([P(x1, hy0 - 0.12, hz0 - 0.1, ox, oy), P(x1, hy1 + 0.12, hz0 - 0.1, ox, oy), P(x1, hy1 + 0.12, hz1 + 0.1, ox, oy), P(x1, hy0 - 0.12, hz1 + 0.1, ox, oy)], '#2b2b2b')
    trunk_parts(ox, oy, xs, 1.5, x1)
    for k, (yy, zz) in enumerate([(hy0 - 0.2, 0.75), (hy1 + 0.2, 0.75), (1.2, hz1 + 0.22), (1.2, hz0 - 0.2)]):   # four small saw discs round the hole
        toothed(x1 + 0.01, 0, 0, 0.0001, ox, oy, 0, 4) if False else None
        c = P(x1, yy, zz, ox, oy)
        pts = []
        for i in range(24):
            a = PH(f, 0.4) + i * math.pi / 12
            rr = 0.2 if i % 2 == 0 else 0.16
            pts.append(P(x1, yy + rr * math.cos(a), zz + rr * math.sin(a), ox, oy))
        poly(pts, STEEL_L, 1.4)
    block(1.9, 0.3, 1.7, ox, oy, STEEL_D, 1, 0.3, 0.3, 0.45)                  # dust pipe on top
    heap(ox, oy, 2.6, 2.1, 6)
    if f is not None:
        dust(ox, oy, [(2.7, 0.8, 0.9, 0.25), (2.7, 1.9, 0.9, 0.25), (2.6, 2.1, 0.3, 0.2)], 70 + f, 4)


ALTS = [
    ('A  Chipper-canter', 'a blue tunnel; a cutter head on its side turns and throws chips into a bin; the trunk goes in round, comes out square', alt_a, [None, -0.4, 0.8, 1.8, 3.0]),
    ('B  Twin circular saws', 'an open gantry with two big toothed discs either side of the lane, sawdust flies; the easiest to read as "a saw"', alt_b, [None, -0.4, 0.8, 1.7, 3.0]),
    ('C  Twin band saws', 'two tall band saws stand beside the lane, the teeth run down the blade; looks like a real sawmill', alt_c, [None, -0.4, 0.5, 1.4, 3.0]),
    ('D  Square-hole box', 'the sibling of the round-hole debarker ring: a box with a square hole, four small saws round it; the round trunk goes in, the square one comes out', alt_d, [None, -0.4, 0.6, 1.5, 3.0]),
]

W, H = 2180, 1690
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the log saw (row 1), four ideas (idle, three frames of work in a loop, done)', 28)
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
