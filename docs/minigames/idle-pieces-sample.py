#!/usr/bin/env python3
"""Generates idle-pieces-sample.svg: a proposal for how every wood piece in the idle sawmill looks.
Run: python3 docs/minigames/idle-pieces-sample.py > docs/minigames/idle-pieces-sample.svg
2:1 isometric: screen = ((x - y) * U, (x + y) * U / 2 - z * U); a piece's length runs along +x (down-right)."""
import math

U = 56  # px per unit
INK = '#4a2c14'
DARK, MEDIUM, LIGHT = '#8a5a33', '#d9a964', '#f3dfae'  # trunk | peeled, cant, boards | planed boards
D = 0.5   # piece diameter / thickness (units)
L = 2.0   # piece length (units)

out = []


def P(x, y, z, ox, oy):
    return (ox + (x - y) * U, oy + (x + y) * U / 2 - z * U)


def shade(hexc, f):
    c = [max(0, min(255, round(int(hexc[i:i + 2], 16) * f))) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(c)


def pts_attr(pts):
    return ' '.join('%.1f,%.1f' % p for p in pts)


def poly(pts, fill, sw=2.2):
    out.append(f'<polygon points="{pts_attr(pts)}" fill="{fill}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round"/>')


def line(a, b, col=INK, sw=1.8):
    out.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{col}" stroke-width="{sw}" stroke-linecap="round"/>')


def hull(pts):
    pts = sorted(set(pts))
    def cr(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def cylinder(x0, y0, z0, ox, oy, color, rings=False, l=L, d=D):
    """A round trunk lying along x: dark bark, or peeled with growth rings on its end."""
    cy, cz, r = y0 + d / 2, z0 + d / 2, d / 2
    def ring(x, rr):
        return [P(x, cy + rr * math.cos(a), cz + rr * math.sin(a), ox, oy) for a in [i * math.pi / 18 for i in range(36)]]
    poly(hull(ring(x0, r) + ring(x0 + l, r)), shade(color, 0.92))
    for a in (math.radians(25), math.radians(-30), math.radians(-85)):  # grain along the body
        line(P(x0 + 0.12 * l, cy + r * math.cos(a), cz + r * math.sin(a), ox, oy),
             P(x0 + 0.88 * l, cy + r * math.cos(a), cz + r * math.sin(a), ox, oy), shade(color, 0.72), 1.3)
    poly(ring(x0 + l, r), shade(color, 1.14))  # the end face
    for f in ((0.62, 0.3) if rings else (0.55,)):
        out.append(f'<polygon points="{pts_attr(ring(x0 + l, r * f))}" fill="none" stroke="{shade(color, 0.65)}" stroke-width="1.3"/>')


def block(x0, y0, z0, ox, oy, color, layers=1, l=L, w=D, h=D):
    """A square-sawn block; `layers` > 1 = that many boards stacked to the same shape, shown by lines."""
    x1, y1, z1 = x0 + l, y0 + w, z0 + h
    poly([P(x0, y0, z1, ox, oy), P(x1, y0, z1, ox, oy), P(x1, y1, z1, ox, oy), P(x0, y1, z1, ox, oy)], shade(color, 1.08))
    poly([P(x0, y1, z1, ox, oy), P(x1, y1, z1, ox, oy), P(x1, y1, z0, ox, oy), P(x0, y1, z0, ox, oy)], shade(color, 0.95))
    poly([P(x1, y0, z1, ox, oy), P(x1, y1, z1, ox, oy), P(x1, y1, z0, ox, oy), P(x1, y0, z0, ox, oy)], shade(color, 0.78))
    for i in range(1, layers):
        z = z0 + h * i / layers
        line(P(x0, y1, z, ox, oy), P(x1, y1, z, ox, oy))
        line(P(x1, y1, z, ox, oy), P(x1, y0, z, ox, oy))


def label(x, y, txt, size=22, anchor='middle', weight=700):
    out.append(f'<text x="{x}" y="{y}" font-family="Helvetica, Arial, sans-serif" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="#2e1c0e">{txt}</text>')


def piece(kind, x, y, z, ox, oy, l=L):
    if kind == 'trunk': cylinder(x, y, z, ox, oy, DARK, False, l)
    elif kind == 'peeled': cylinder(x, y, z, ox, oy, MEDIUM, True, l)
    elif kind == 'cant': block(x, y, z, ox, oy, MEDIUM, 1, l)
    elif kind == 'plank': block(x, y, z, ox, oy, MEDIUM, 4, l)
    elif kind == 'planed': block(x, y, z, ox, oy, LIGHT, 4, l)


def stack(kind, ox, oy, x=0.0, z=0.0, cols=3, rows=3):
    """Pieces lying lengthwise, `cols` across (y), `rows` high (z); far and low ones first."""
    for j in range(cols):
        for k in range(rows):
            piece(kind, x, j * D, z + k * D, ox, oy)


W, H = 1560, 1330
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 46, 'Idle sawmill: one piece size, five looks', 30)

KINDS = [('trunk', '1  Trunk', 'forest, truck, pile, to debarker'),
         ('peeled', '2  Peeled trunk', 'after the debarker'),
         ('cant', '3  Square log (cant)', 'after saw 1, same colour'),
         ('plank', '4  Four boards', 'after saw 2: 4 x 1/4 height'),
         ('planed', '5  Planed boards', 'after the planer, lighter')]

# row 1: a single piece through the chain
for i, (kind, name, sub) in enumerate(KINDS):
    cx = 160 + i * 310
    piece(kind, 0, 0, 0, cx - 25, 190)
    label(cx, 315, name, 22)
    label(cx, 342, sub, 16, weight=400)
    if i:
        label(cx - 155, 232, '&#8594;', 34)

# row 2: the same pieces stacked 3 x 3, lengthwise (storage, forks, yard)
label(W / 2, 420, 'Stacked 3 x 3, lengthwise: storage, forklift forks, loading yard', 24)
for i, (kind, name, _) in enumerate(KINDS):
    cx = 160 + i * 310
    stack(kind, cx - 25, 590)
    label(cx, 790, name.split('  ')[1], 20)

# row 3: logging truck, two 3 x 3 stacks end to end on a bed 3 pieces wide
label(W / 2, 870, 'Logging truck: two 3 x 3 stacks of trunks, lengthwise', 24)
tx, ty = 330, 1060
bed_l, bed_w = 4.4, 3 * D + 0.1
y0, y1 = -0.05, bed_w - 0.05          # truck spans y0..y1
BZ0, BZ1 = 0.3, 0.45                   # chassis bottom / bed top
STEEL, STEEL_D = '#7d8791', '#4f5963'
CAB_L, CAB_H = 0.9, 1.25


def wheel(xc, y, out_dir, r=0.34, t=0.24):
    """A thick tire standing beside the frame: a round tread seen from the side, with the tread's thickness behind it."""
    ring = lambda rr, yy: [P(xc + rr * math.cos(a), yy, r + rr * math.sin(a), tx, ty) for a in [i * math.pi / 14 for i in range(28)]]
    yi, yo = y, y + out_dir * t            # inner and outer face of the tire
    poly(hull(ring(r, yi) + ring(r, yo)), '#1f1f1f')
    poly(ring(r, yo), '#2f2f2f')
    poly(ring(r * 0.62, yo), '#aeb6bd', 1.6)   # rim
    poly(ring(r * 0.22, yo), STEEL_D, 1.2)     # hub


def face_x(x, u0, u1, v0, v1, zb, h, w0, w, color, sw=1.6):  # a rectangle on a +x face
    poly([P(x, w0 + u0 * w, zb + v1 * h, tx, ty), P(x, w0 + u1 * w, zb + v1 * h, tx, ty), P(x, w0 + u1 * w, zb + v0 * h, tx, ty), P(x, w0 + u0 * w, zb + v0 * h, tx, ty)], color, sw)


def face_y(y, u0, u1, v0, v1, zb, h, x0, l, color, sw=1.6):  # a rectangle on a +y face
    poly([P(x0 + u0 * l, y, zb + v1 * h, tx, ty), P(x0 + u1 * l, y, zb + v1 * h, tx, ty), P(x0 + u1 * l, y, zb + v0 * h, tx, ty), P(x0 + u0 * l, y, zb + v0 * h, tx, ty)], color, sw)


def stake(x, y):  # an upright post that holds the load
    block(x, y, BZ1, tx, ty, STEEL_D, 1, 0.1, 0.1, 1.55)


AXLES = (0.8, 1.6, bed_l + 0.4, bed_l + 1.35)
block(0, y0, BZ0, tx, ty, STEEL, 1, bed_l, bed_w, BZ1 - BZ0)   # chassis + bed
block(0, y0, BZ1 - 0.04, tx, ty, STEEL_D, 1, bed_l, bed_w, 0.04)
POSTS = [x0 + f * L for x0 in (0.15, 0.15 + L + 0.05) for f in (0.25, 0.75)]   # each stack: trunk length split 1/4 | 1/2 | 1/4
for x in POSTS:                         # far posts
    stake(x, y0 + 0.02)
for sx in (0.15, 0.15 + L + 0.05):
    stack('trunk', tx, ty, x=sx, z=BZ1)
for x in POSTS:                         # near posts
    stake(x, y1 - 0.12)
# tractor: a long-nose truck like the reference (hood in front, cab behind it, chrome exhaust stacks)
CREAM, GLASS, CHROME = '#d9534f', '#bfe3f2', '#c9ced2'
cx0 = bed_l + 0.03                    # cab start
cab_l, cab_h = 0.85, 1.35
hood_l, hood_w, hood_h = 0.95, 0.95, 0.7
hy0 = y0 + (bed_w - hood_w) / 2       # the hood is narrower than the cab
block(bed_l, y0 + 0.1, BZ0, tx, ty, STEEL, 1, cab_l + hood_l + 0.05, bed_w - 0.2, BZ1 - BZ0)   # frame under the tractor
block(cx0, y0, BZ1, tx, ty, CREAM, 1, cab_l, bed_w, cab_h - (BZ1 - BZ0) + 0.0)               # cab
block(cx0 - 0.0, y0 + 0.05, BZ0 + cab_h + 0.0, tx, ty, shade(CREAM, 0.9), 1, cab_l, bed_w - 0.1, 0.05)  # roof lip
fx = cx0 + cab_l                       # front of the cab
face_x(fx, 0.08, 0.92, 0.5, 0.9, BZ0, cab_h, y0, bed_w, GLASS)                               # windscreen above the hood
face_y(y1, 0.1, 0.52, 0.5, 0.9, BZ0, cab_h, cx0, cab_l, GLASS)                               # door window
face_y(y1, 0.58, 0.9, 0.5, 0.9, BZ0, cab_h, cx0, cab_l, GLASS)                               # rear side window
line(P(cx0 + 0.55 * cab_l, y1, BZ0 + 0.15 * cab_h, tx, ty), P(cx0 + 0.55 * cab_l, y1, BZ0 + 0.5 * cab_h, tx, ty), INK, 1.4)  # door edge
block(fx, hy0, BZ0 + 0.05, tx, ty, CREAM, 1, hood_l, hood_w, hood_h)                          # the hood
hx = fx + hood_l
face_x(hx, 0.12, 0.88, 0.1, 0.9, BZ0 + 0.05, hood_h, hy0, hood_w, CHROME)                      # grille
for k in (0.3, 0.5, 0.7):
    line(P(hx, hy0 + 0.12 * hood_w, BZ0 + 0.05 + k * hood_h, tx, ty), P(hx, hy0 + 0.88 * hood_w, BZ0 + 0.05 + k * hood_h, tx, ty), shade(CHROME, 0.6), 1.2)
face_x(hx, 0.0, 0.12, 0.5, 0.85, BZ0 + 0.05, hood_h, hy0, hood_w, '#ffe27a')                   # headlights
face_x(hx, 0.88, 1.0, 0.5, 0.85, BZ0 + 0.05, hood_h, hy0, hood_w, '#ffe27a')
block(hx - 0.06, y0 + 0.0, BZ0 - 0.02, tx, ty, '#2b2b2b', 1, 0.16, bed_w, 0.2)                 # bumper
for yy in (y0 + 0.03, y1 - 0.11):                                                            # chrome exhaust stacks behind the cab
    block(cx0 - 0.04, yy, BZ0 + 0.3, tx, ty, CHROME, 1, 0.08, 0.08, 1.6)
for wx in AXLES:                        # near-side wheels
    wheel(wx, y1, 1)

# palette
out.append('<g>')
label(1130, 1000, 'Palette (current game colours)', 20, 'start')
for i, (c, name) in enumerate(((DARK, 'dark: trunk'), (MEDIUM, 'medium: peeled, cant, boards'), (LIGHT, 'light: planed boards'))):
    y = 1025 + i * 52
    out.append(f'<rect x="1130" y="{y}" width="48" height="36" rx="6" fill="{c}" stroke="{INK}" stroke-width="2"/>')
    label(1196, y + 25, f'{name}  {c}', 17, 'start', 400)
label(1130, 1195, 'Lines on a block = it is cut into boards.', 16, 'start', 400)
out.append('</g></svg>')
print('\n'.join(out))
