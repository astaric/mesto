#!/usr/bin/env python3
"""Generates idle-forklift-sample.svg: a proposal for the forklifts (empty and with loads) of the idle sawmill.
Run: python3 docs/minigames/idle-forklift-sample.py > docs/minigames/idle-forklift-sample.svg
Reuses the piece drawing of idle-pieces-sample.py (everything before its `W, H` line). Facing +x (down-right), the viewer sees its front and its right side."""
import os, math
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-pieces-sample.py')).read()
exec(src[:src.index('W, H =')])

YEL, YEL_D, STEEL, STEEL_L, DARKG, TIRE = '#ffc83d', '#d9a21f', '#8a8a8a', '#b9bec3', '#4a4a4a', '#1f1f1f'
BH = 0.125  # a board is a quarter of a piece's height


def wheel(xc, y, ox, oy, r, t, outward=1):
    ring = lambda rr, yy: [P(xc + rr * math.cos(a), yy, r + rr * math.sin(a), ox, oy) for a in [i * math.pi / 14 for i in range(28)]]
    yo = y + outward * t
    poly(hull(ring(r, y) + ring(r, yo)), TIRE)
    poly(ring(r, yo), '#2f2f2f')
    poly(ring(r * 0.55, yo), STEEL_L, 1.6)
    poly(ring(r * 0.2, yo), DARKG, 1.2)


def forklift(ox, oy, kind=None, n=0):
    # body: low chassis, the engine hood behind the seat, a counterweight at the back
    block(-0.75, -0.42, 0.14, ox, oy, YEL, 1, 1.05, 0.84, 0.3)            # chassis
    block(-0.78, -0.45, 0.14, ox, oy, DARKG, 1, 0.4, 0.9, 0.62)           # counterweight
    block(-0.35, -0.3, 0.44, ox, oy, YEL_D, 1, 0.55, 0.6, 0.18)           # engine cover / seat base
    for (x, y) in ((-0.38, -0.4), (0.0, -0.4)):                          # far posts of the overhead guard
        block(x, y, 0.44, ox, oy, DARKG, 1, 0.06, 0.06, 0.78)
    block(-0.3, -0.2, 0.62, ox, oy, DARKG, 1, 0.22, 0.4, 0.2)             # seat
    # mast: two uprights, a cross bar, the carriage plate they lift
    for y in (-0.42, 0.34):
        block(0.3, y, 0.14, ox, oy, STEEL, 1, 0.1, 0.08, 1.05)
    block(0.3, -0.42, 1.14, ox, oy, STEEL, 1, 0.1, 0.84, 0.06)
    block(0.4, -0.45, 0.17, ox, oy, STEEL_L, 1, 0.07, 0.9, 0.5)
    # wheels on the near side: big in front, small behind
    wheel(0.05, 0.42, ox, oy, 0.2, 0.18)
    wheel(-0.5, 0.42, ox, oy, 0.16, 0.16)
    for (x, y) in ((-0.38, 0.34), (0.0, 0.34)):                          # near posts
        block(x, y, 0.44, ox, oy, DARKG, 1, 0.06, 0.06, 0.78)
    block(-0.45, -0.45, 1.22, ox, oy, DARKG, 1, 0.6, 0.9, 0.06)            # roof
    # forks
    for y in (-0.38, 0.26):
        block(0.47, y, 0.14, ox, oy, STEEL, 1, 1.18, 0.12, 0.05)
    # load: the pieces lie across the forks (along y), stacked along the forks, so they hang out on both sides
    if kind in ('trunk', 'peeled', 'cant'):
        cells = sorted(range(n), key=lambda i: (i % 2, i // 2))   # nearer to the mast first (far), lower first
        for i in cells:
            col, layer = i % 2, i // 2
            piece_y(kind, 0.52 + col * D, -L / 2, 0.19 + layer * D, ox, oy)
    elif kind in ('plank', 'planed'):
        for s in range(n):
            block(0.52 + (D / 2 if False else 0.0) + 0.0, -L / 2, 0.19 + s * BH, ox, oy, MEDIUM if kind == 'plank' else LIGHT, 1, D, L, BH)


def piece_y(kind, x0, y0, z0, ox, oy):
    """A piece lying along y (across the forklift): corner (x0, y0), length L."""
    if kind == 'cant':
        block(x0, y0, z0, ox, oy, MEDIUM, 1, D, L, D)
        return
    color = DARK if kind == 'trunk' else MEDIUM
    cx, cz, r = x0 + D / 2, z0 + D / 2, D / 2
    ring = lambda y, f=1: [P(cx + r * f * math.cos(a), y, cz + r * f * math.sin(a), ox, oy) for a in [i * math.pi / 18 for i in range(36)]]
    poly(hull(ring(y0) + ring(y0 + L)), shade(color, 0.92))
    for a in (math.radians(20), math.radians(-35), math.radians(-85)):
        line(P(cx + r * math.cos(a), y0 + 0.12 * L, cz + r * math.sin(a), ox, oy), P(cx + r * math.cos(a), y0 + 0.88 * L, cz + r * math.sin(a), ox, oy), shade(color, 0.72), 1.3)
    poly(ring(y0 + L), shade(color, 1.14))
    for f in ((0.62, 0.3) if kind == 'peeled' else (0.55,)):
        out.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="1.3"/>' % (pts_attr(ring(y0 + L, f)), shade(color, 0.65)))


W, H = 1560, 880
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 46, 'Idle sawmill: the forklift, empty and with loads (up to 4 pieces, lying across the forks)', 28)

row1 = [(None, 0, 'Empty'), ('trunk', 1, '1 trunk'), ('trunk', 2, '2 trunks'), ('trunk', 3, '3 trunks'), ('trunk', 4, '4 trunks')]
row2 = [('peeled', 4, '4 peeled trunks'), ('cant', 4, '4 square logs'), ('plank', 2, '2 boards'), ('plank', 4, '4 boards'), ('planed', 4, '4 planed boards')]
for r, rowdef in enumerate((row1, row2)):
    for i, (kind, n, name) in enumerate(rowdef):
        cx = 190 + i * 300
        oy = 240 + r * 380
        forklift(cx - 40, oy, kind, n)
        label(cx, oy + 150, name, 22)
label(W / 2, 810, 'Boards lie across the forks too, stacked up to 4 (the same shape as one square log).', 18, weight=400)
out.append('</svg>')
print('\n'.join(out))
