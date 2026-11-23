#!/usr/bin/env python3
"""Generates idle-logsaw1-sample.svg: the log saw as ONE circular saw. A trunk needs four passes (forward through the saw, back, turn a quarter)
before it is a square log (cant); every pass cuts one flat on the side the saw stands on, so the flats show up one by one.
Run: python3 docs/minigames/idle-logsaw1-sample.py > docs/minigames/idle-logsaw1-sample.svg
Reuses the drawing helpers of idle-pieces-sample.py. The flow runs along +x (down-right). Frames: idle, cut 1..4 (the saw is halfway through the trunk), done."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-pieces-sample.py')).read()
exec(src[:src.index('W, H =')])
U = 44
STEEL, STEEL_D, STEEL_L = '#7d8791', '#4f5963', '#dfe4e8'
BLUE, ORANGE = '#7f9fc2', '#d9814f'
DUST = '#f1d27a'
CY, CH = 1.2, 0.5
R, FLAT = D / 2, 0.8 * D / 2     # flats stand 0.8 of the radius from the axis, so four of them leave a square with rounded corners
SAW_Y = CY - FLAT                # the saw's plane: it takes the far side off
COLS = ['Idle', 'Cut 1 of 4', 'Cut 2 of 4', 'Cut 3 of 4', 'Cut 4 of 4', 'Done']


def conveyor(ox, oy):
    block(-1.4, CY - 0.4, 0, ox, oy, STEEL, 1, 6.4, 0.8, CH)
    for x in [i * 0.4 - 1.2 for i in range(16)]:
        line(P(x, CY - 0.4, CH, ox, oy), P(x, CY + 0.4, CH, ox, oy), shade(STEEL, 0.7), 1.2)


def section(flats):
    """The trunk's cross-section (y, z), the circle cut by flats whose outward normals point at the given angles (0 = towards the viewer's side, pi/2 = up)."""
    pts = [(R * math.cos(i * math.pi / 20), R * math.sin(i * math.pi / 20)) for i in range(40)]
    for a in flats:
        n = (math.cos(a), math.sin(a))
        f = lambda p: n[0] * p[0] + n[1] * p[1] - FLAT
        new = []
        for p, q in zip(pts, pts[1:] + pts[:1]):
            fp, fq = f(p), f(q)
            if fp <= 0: new.append(p)
            if fp * fq < 0:
                t = fp / (fp - fq); new.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
        pts = new
    return pts


def extrude(x0, x1, ox, oy, flats, color=MEDIUM):
    """The peeled trunk between x0 and x1, with `flats` sawn on it."""
    if x1 - x0 < 0.05: return
    pts = section(flats)
    cz = CH + R
    on_flat = lambda p: any(abs(math.cos(a) * p[0] + math.sin(a) * p[1] - FLAT) < 1e-6 for a in flats)
    X = lambda x, p: P(x, CY + p[0], cz + p[1], ox, oy)
    n = len(pts)
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        ny, nz = q[1] - p[1], -(q[0] - p[0])      # outward normal of a counter-clockwise polygon
        if ny + nz <= 1e-9: continue
        flat = on_flat(p) and on_flat(q)
        L = math.hypot(ny, nz); br = 0.82 + 0.22 * nz / L + 0.06 * ny / L
        col = shade(LIGHT if flat else color, br if not flat else br * 0.98)
        pl = [X(x0, p), X(x1, p), X(x1, q), X(x0, q)]
        out.append(f'<polygon points="{pts_attr(pl)}" fill="{col}" stroke="{col}" stroke-width="1"/>')
    cap = [X(x1, p) for p in pts]
    outline = hull([X(x, p) for x in (x0, x1) for p in pts])
    out.append(f'<polygon points="{pts_attr(outline)}" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>')
    poly(cap, shade(color, 1.14))
    for i in range(n):                              # the edges where a flat meets the round
        p, q = pts[i], pts[(i + 1) % n]; r_ = pts[(i + 2) % n]
        if on_flat(q) and not (on_flat(p) and on_flat(q) and on_flat(r_)):
            pass
    for i in range(n):
        p = pts[i]
        prev, nxt = pts[i - 1], pts[(i + 1) % n]
        if on_flat(p) and (not on_flat(prev) or not on_flat(nxt)) and p[0] + p[1] > -0.1:
            line(X(x0, p), X(x1, p), shade(color, 0.6), 1.4)
    for f in (0.6,):
        out.append(f'<polygon points="{pts_attr([X(x1, (p[0] * f, p[1] * f)) for p in pts])}" fill="none" stroke="{shade(color, 0.65)}" stroke-width="1.3"/>')


def flats_after(k):   # k flats on the part that has been through the saw: the newest faces the saw (far side, pi), older ones were turned a quarter at a time
    return [math.pi - j * math.pi / 2 for j in range(k)]


def toothed(y, cx, cz, r, ox, oy, phase, teeth=18):
    pts = []
    for i in range(teeth * 2):
        a = phase + i * math.pi / teeth
        rr = r if i % 2 == 0 else r * 0.86
        pts.append(P(cx + rr * math.cos(a), y, cz + rr * math.sin(a), ox, oy))
    poly(pts, STEEL_L, 1.6)
    for k in range(3):                              # slots in the disc so the turning shows
        a = phase * 0.8 + k * 2 * math.pi / 3
        line(P(cx + r * 0.35 * math.cos(a), y, cz + r * 0.35 * math.sin(a), ox, oy), P(cx + r * 0.7 * math.cos(a), y, cz + r * 0.7 * math.sin(a), ox, oy), STEEL, 2)
    poly([P(cx + r * 0.25 * math.cos(i * math.pi / 8), y, cz + r * 0.25 * math.sin(i * math.pi / 8), ox, oy) for i in range(16)], STEEL_D, 1.4)


def dust(ox, oy, spots, seed, n=5):
    rnd = random.Random(seed)
    for (x, y, z, s) in spots:
        for _ in range(n):
            block(x + rnd.uniform(-s, s), y + rnd.uniform(-s, s), max(0.02, z + rnd.uniform(-s, s)), ox, oy, DUST, 1, 0.1, 0.08, 0.06)


def slabs(ox, oy, k, x0, x1, y):
    """The slabs the saw took off, lying on the far side of the belt."""
    for j in range(k):
        block(x0, y + (j % 2) * 0.13, (j // 2) * 0.1, ox, oy, shade(MEDIUM, 0.9), 1, x1 - x0, 0.12, 0.09)


def arrow(ox, oy, x0, x1, y, z, col=INK):
    a, b = P(x0, y, z, ox, oy), P(x1, y, z, ox, oy)
    line(a, b, col, 3)
    d = 1 if x1 > x0 else -1
    line(b, P(x1 - d * 0.18, y - 0.1, z, ox, oy), col, 3); line(b, P(x1 - d * 0.18, y + 0.1, z, ox, oy), col, 3)


def turn_pad(ox, oy, x, active):
    """A round turntable under the trunk's resting place: it turns the trunk a quarter between passes."""
    c = [P(x + 0.55 * math.cos(i * math.pi / 12), CY + 0.55 * math.sin(i * math.pi / 12), CH + 0.02, ox, oy) for i in range(24)]
    poly(c, ORANGE, 1.8)
    if active:
        for a in (0.3, 0.3 + math.pi):
            line(P(x + 0.4 * math.cos(a), CY + 0.4 * math.sin(a), CH + 0.04, ox, oy), P(x + 0.4 * math.cos(a + 0.9), CY + 0.4 * math.sin(a + 0.9), CH + 0.04, ox, oy), INK, 2.2)


# ---------- A: the trunk shuttles through a fixed saw ----------
def alt_a(ox, oy, f, xs, k):
    conveyor(ox, oy)
    sx = 2.0
    block(1.65, 0.1, 0, ox, oy, BLUE, 1, 0.7, 0.45, 1.9)                         # the frame behind the saw
    block(1.8, 0.55, 1.25, ox, oy, STEEL_D, 1, 0.4, 0.45, 0.3)                   # the arbor out to the disc
    toothed(SAW_Y, sx, 1.4, 0.95, ox, oy, (f or 0) * 0.5)
    block(1.65, 0.1, 1.9, ox, oy, shade(BLUE, 0.9), 1, 0.7, 0.45, 0.2)           # a hood over the top
    slabs(ox, oy, k if xs is not None else 0, 2.35, 3.1, 0.35)
    if xs is not None:
        if f is None:                                                           # done: the finished cant on the way out
            extrude(xs, xs + 2.0, ox, oy, flats_after(4))
        else:
            extrude(xs, sx, ox, oy, flats_after(k)[1:])                          # not yet sawn on this pass
            extrude(sx, xs + 2.0, ox, oy, flats_after(k))                        # sawn
    if f is not None:
        dust(ox, oy, [(2.15, 0.85, 0.7, 0.2), (2.3, 0.7, 0.2, 0.25)], 80 + f, 4)
        arrow(ox, oy, 0.2, 0.8, 2.15, 0.15)
    turn_pad(ox, oy, -0.8, f is not None and k > 1)


# ---------- B: the trunk lies still on a turntable, the saw travels along an overhead rail ----------
def alt_b(ox, oy, f, sx, k):
    conveyor(ox, oy)
    TX0, TX1 = 1.0, 3.0
    for x in (0.6, 3.7):                                                         # the rail's posts (far side)
        block(x, 0.2, 0, ox, oy, STEEL_D, 1, 0.25, 0.25, 2.3)
    block(0.55, 0.2, 2.3, ox, oy, BLUE, 1, 3.45, 0.25, 0.22)                     # the rail
    s = sx if sx is not None else 3.4                                           # the saw parks at the far end
    block(s - 0.3, 0.12, 2.05, ox, oy, ORANGE, 1, 0.6, 0.42, 0.47)               # the carriage
    block(s - 0.1, 0.42, 1.2, ox, oy, STEEL_D, 1, 0.2, 0.5, 0.95)                # arm down to the arbor
    toothed(SAW_Y, s, 1.4, 0.95, ox, oy, (f or 0) * 0.5)
    slabs(ox, oy, k if sx is not None or f is None else 0, 1.0, 3.0, 0.35)
    if f is None and k == 0:
        pass                                                                    # idle: no trunk yet
    elif f is None:
        extrude(TX0, TX1, ox, oy, flats_after(4))
    else:
        extrude(TX0, s, ox, oy, flats_after(k))                                  # behind the saw: sawn
        extrude(s, TX1, ox, oy, flats_after(k)[1:])
    if f is not None:
        dust(ox, oy, [(s, 0.85, 0.7, 0.2), (s + 0.1, 0.7, 0.2, 0.25)], 90 + f, 4)
        arrow(ox, oy, 0.6, 1.3, 2.4, 0.15)
    turn_pad(ox, oy, 2.0, f is not None and k > 1)


ALTS = [
    ('A  Trunk shuttles through a fixed saw',
     'one big disc stands beside the belt; the trunk goes forward through it, back, a turntable turns it a quarter, and again: four passes, a flat more each time',
     alt_a, [None, 1.0, 1.0, 1.0, 1.0, 3.0]),
    ('B  Saw travels along a rail over a trunk that lies still',
     'the trunk rests on a turntable, the saw rides an overhead rail forward and back (fewer things moving on the belt); same four passes',
     alt_b, [None, 1.8, 2.0, 2.2, 2.4, None]),
]

W, H = 2180, 880
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the log saw as one circular saw, four passes (cut 1 to 4, the flats are sawn one by one, then done)', 26)
for r, (name, sub, fn, xss) in enumerate(ALTS):
    top = 70 + r * 400
    label(30, top + 24, name, 24, 'start')
    label(30, top + 48, sub, 16, 'start', 400)
    for c in range(6):
        ox, oy = c * 355 + 140, top + 215
        fn(ox, oy, None if c in (0, 5) else c - 1, xss[c], c if c < 5 else 4)
        label(ox + 120, top + 380, COLS[c], 20, weight=700)
out.append('</svg>')
print('\n'.join(out))
