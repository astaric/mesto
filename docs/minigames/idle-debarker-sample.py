#!/usr/bin/env python3
"""Generates idle-debarker-sample.svg: three proposals for the debarker, idle and working (a loop of three frames), then done.
Run: python3 docs/minigames/idle-debarker-sample.py > docs/minigames/idle-debarker-sample.svg
Reuses the drawing helpers of idle-pieces-sample.py (everything before its `W, H` line). The flow runs along +x (down-right)."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-pieces-sample.py')).read()
exec(src[:src.index('W, H =')])
U = 44  # smaller than the piece sheet: a machine is 3 x 3 tiles

STEEL, STEEL_D, STEEL_L = '#7d8791', '#4f5963', '#dfe4e8'
ORANGE = '#d9814f'      # the debarker's colour in the game today
BARK = '#6b4423'
CY = 1.2                # the trunk's lane (y); the machine is 2.4 wide
IN_BAND = 0.55 * 0 + 0   # (unused)
COLS = ['Idle', 'Working 1', 'Working 2', 'Working 3', 'Done']


def conveyor(ox, oy, ch):
    block(-1.4, CY - 0.4, 0, ox, oy, STEEL, 1, 6.4, 0.8, ch)
    for x in [i * 0.4 - 1.2 for i in range(16)]:
        line(P(x, CY - 0.4, ch, ox, oy), P(x, CY + 0.4, ch, ox, oy), shade(STEEL, 0.7), 1.2)


def seg(ox, oy, ch, x0, x1, kind):
    """Part of a trunk lying on the conveyor between x0 and x1: dark before the machine, peeled after it."""
    if x1 - x0 < 0.06:
        return
    cylinder(x0, CY - D / 2, ch, ox, oy, DARK if kind == 'dark' else MEDIUM, kind != 'dark', x1 - x0)


def chips(ox, oy, spots, seed):
    rnd = random.Random(seed)
    for (x, y, z, spread) in spots:
        for _ in range(4):
            a, b, c = x + rnd.uniform(-spread, spread), y + rnd.uniform(-spread, spread), max(0.02, z + rnd.uniform(-spread, spread))
            block(a, b, c, ox, oy, BARK, 1, 0.14, 0.1, 0.07)


def pile(ox, oy, x, y, n=7):
    for i in range(n):
        block(x + (i % 3) * 0.16, y + (i // 3) * 0.14, (i // 3) * 0.08, ox, oy, BARK if i % 2 else shade(BARK, 1.2), 1, 0.2, 0.16, 0.1)


def yz_ring(x, cy, cz, r, ox, oy, n=36):
    return [P(x, cy + r * math.cos(i * 2 * math.pi / n), cz + r * math.sin(i * 2 * math.pi / n), ox, oy) for i in range(n)]


def xz_ring(y, cx, cz, r, ox, oy, n=36):
    return [P(cx + r * math.cos(i * 2 * math.pi / n), y, cz + r * math.sin(i * 2 * math.pi / n), ox, oy) for i in range(n)]


# ---------------- A: ring debarker: the trunk is pushed through a spinning ring of blades ----------------
def alt_a(ox, oy, frame, xs):
    ch = 0.5; cz = ch + D / 2
    conveyor(ox, oy, ch)
    block(1.1, 0.0, 0, ox, oy, STEEL_D, 1, 1.2, 2.4, 0.3)                       # base under the ring
    if xs is not None:
        seg(ox, oy, ch, xs, min(xs + 2.0, 1.45), 'dark')
    x0, x1, ro, ri = 1.45, 1.95, 0.85, 0.42
    poly(hull(yz_ring(x0, CY, cz, ro, ox, oy) + yz_ring(x1, CY, cz, ro, ox, oy)), shade(ORANGE, 0.85))
    poly(yz_ring(x1, CY, cz, ro, ox, oy), ORANGE)
    poly(yz_ring(x1, CY, cz, ri, ox, oy), '#2b2b2b')
    if xs is not None:                                                            # the peeled trunk comes out of the hole
        pass
    a0 = [0, 0.6, 1.2, 1.8][frame % 4] if frame is not None else 0
    for k in range(4):                                                            # four blades turn round the hole
        a = a0 + k * math.pi / 2
        tip = ri - 0.2
        poly([P(x1, CY + ri * math.cos(a - 0.22), cz + ri * math.sin(a - 0.22), ox, oy), P(x1, CY + ri * math.cos(a + 0.22), cz + ri * math.sin(a + 0.22), ox, oy),
              P(x1, CY + tip * math.cos(a + 0.5), cz + tip * math.sin(a + 0.5), ox, oy)], STEEL_L, 1.6)
    for k in range(8):                                                            # bolts on the ring
        a = k * math.pi / 4 + 0.2
        c = P(x1, CY + 0.64 * math.cos(a), cz + 0.64 * math.sin(a), ox, oy)
        out.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="2.5" fill="{shade(ORANGE, 0.7)}"/>')
    if xs is not None and xs + 2.0 > 1.95:
        seg(ox, oy, ch, 2.0, xs + 2.0, 'peeled')
    pile(ox, oy, 2.2, 1.9)
    if frame is not None:
        chips(ox, oy, [(2.1, 1.0, 0.7, 0.3), (2.3, 1.7, 0.4, 0.25), (2.6, 2.0, 0.15, 0.2)], 10 + frame)


# ---------------- B: drum debarker: the trunk tumbles inside a long rotating drum ----------------
def alt_b(ox, oy, frame, xs):
    ch = 0.75; cz = ch + D / 2; r = 0.85; dz = cz
    conveyor(ox, oy, ch)
    for y in (0.15, 1.95):                                                        # two cradles under the drum
        block(1.0, y, 0, ox, oy, STEEL_D, 1, 0.3, 0.3, dz - r + 0.15)
        block(2.4, y, 0, ox, oy, STEEL_D, 1, 0.3, 0.3, dz - r + 0.15)
    if xs is not None:
        seg(ox, oy, ch, xs, min(xs + 2.0, 0.65), 'dark')
    x0, x1 = 0.65, 3.05
    poly(hull(yz_ring(x0, CY, dz, r, ox, oy) + yz_ring(x1, CY, dz, r, ox, oy)), shade(ORANGE, 0.9))
    ph = [0, 0.3, 0.6, 0.9][frame % 4] if frame is not None else 0
    for k in range(8):                                                            # long slats turn with the drum (only the ones facing us)
        a = ph + k * math.pi / 4
        if math.cos(a) + math.sin(a) > 0.1:
            line(P(x0 + 0.1, CY + r * math.cos(a), dz + r * math.sin(a), ox, oy), P(x1 - 0.05, CY + r * math.cos(a), dz + r * math.sin(a), ox, oy), shade(ORANGE, 0.6), 2)
    for x in (1.45, 2.25):                                                        # fixed hoops
        pts = yz_ring(x, CY, dz, r, ox, oy, 48)
        vis = [(i, p) for i, p in enumerate(pts) if math.cos(i * 2 * math.pi / 48) + math.sin(i * 2 * math.pi / 48) > 0.1]
        for (i, p), (j, q) in zip(vis, vis[1:]):
            if j == i + 1:
                line(p, q, STEEL_D, 4)
    poly(yz_ring(x1, CY, dz, r, ox, oy), ORANGE)
    poly(yz_ring(x1, CY, dz, 0.5, ox, oy), '#2b2b2b')
    poly(yz_ring(x1, CY, dz, 0.58, ox, oy), 'none', 2) if False else None
    if xs is not None and xs + 2.0 > 3.05:
        seg(ox, oy, ch, 3.1, xs + 2.0, 'peeled')
    block(1.1, 2.3, 0, ox, oy, STEEL_D, 1, 1.8, 0.7, 0.35)                        # bark bin at the near side
    pile(ox, oy, 1.3, 2.4, 6)
    if frame is not None:
        chips(ox, oy, [(1.3, 2.25, 0.5, 0.2), (2.0, 2.3, 0.35, 0.25), (2.7, 2.2, 0.5, 0.2)], 20 + frame)


# ---------------- C: gantry with a cutter head: a spinning drum of blades lowered onto the trunk ----------------
def alt_c(ox, oy, frame, xs):
    ch = 0.5; cz = ch + D / 2
    conveyor(ox, oy, ch)
    cx, hz = 2.0, ch + D + 0.32
    for y in (0.2, 2.05):                                                          # gantry posts (far one first)
        if y < 1:
            block(cx - 0.1, y, 0, ox, oy, STEEL_D, 1, 0.2, 0.2, 1.75)
    if xs is not None:
        seg(ox, oy, ch, xs, min(xs + 2.0, cx), 'dark')
        if xs + 2.0 > cx:
            seg(ox, oy, ch, cx, xs + 2.0, 'peeled')
    block(cx - 0.1, 0.2, 1.6, ox, oy, ORANGE, 1, 0.2, 2.05, 0.2)                    # cross beam
    # the cutter head: a drum across the lane
    y0, y1, r = 0.55, 1.85, 0.34
    poly(hull(xz_ring(y0, cx, hz, r, ox, oy) + xz_ring(y1, cx, hz, r, ox, oy)), shade(STEEL, 0.9))
    for y in (y0 + 0.05, y1 - 0.12):                                              # arms from the beam to the head
        block(cx - 0.05, y, hz, ox, oy, STEEL_D, 1, 0.1, 0.1, 1.6 - hz)
    poly(xz_ring(y1, cx, hz, r, ox, oy), STEEL_L)
    ph = [0, 0.4, 0.8, 1.2][frame % 4] if frame is not None else 0
    for k in range(6):
        a = ph + k * math.pi / 3
        line(P(cx, y1, hz, ox, oy), P(cx + r * math.cos(a), y1, hz + r * math.sin(a), ox, oy), ORANGE, 3)
    c = P(cx, y1, hz, ox, oy)
    out.append(f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="4" fill="{STEEL_D}"/>')
    block(cx - 0.1, 2.05, 0, ox, oy, STEEL_D, 1, 0.2, 0.2, 1.75)                    # near post
    pile(ox, oy, 2.6, 1.95, 6)
    if frame is not None:
        chips(ox, oy, [(1.9, 1.0, 1.1, 0.35), (2.3, 1.4, 0.9, 0.3), (2.5, 1.9, 0.5, 0.2)], 30 + frame)


ALTS = [
    ('A  Ring debarker', 'a ring of blades turns round a hole; the trunk is pushed through it', alt_a, [None, -0.2, 0.9, 1.7, 2.3], 'A'),
    ('B  Drum debarker', 'a long drum turns; the trunk goes in dark and comes out peeled', alt_b, [None, -0.9, 0.7, 1.6, 3.1], 'B'),
    ('C  Cutter head', 'an open gantry lowers a spinning blade drum on the trunk', alt_c, [None, -0.4, 0.6, 1.4, 2.6], 'C'),
]

W, H = 2180, 1290
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the debarker, three ideas (idle, three frames of work in a loop, done)', 28)
for r, (name, sub, fn, xss, _) in enumerate(ALTS):
    top = 70 + r * 400
    label(30, top + 24, name, 24, 'start')
    label(30, top + 48, sub, 16, 'start', 400)
    for c in range(5):
        ox, oy = c * 430 + 190, top + 215
        frame = None if c in (0, 4) else c - 1
        xs = xss[c] if c else None
        fn(ox, oy, frame, xs)
        label(ox + 120, top + 380, COLS[c], 20, weight=700)
out.append('</svg>')
print('\n'.join(out))
