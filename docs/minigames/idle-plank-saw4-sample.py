#!/usr/bin/env python3
"""Generates idle-plank-saw4-sample.svg: round 4 for the plank saw (saw 2, row 2): the open band-saw tower with a plain RECTANGULAR blade that slides left and right
instead of a band loop. Level 1: 1 blade, level 25: 2 blades, level 50: 3 blades (all four planks at once).
Run: python3 docs/minigames/idle-plank-saw4-sample.py > docs/minigames/idle-plank-saw4-sample.svg
R1 of round 3 with slots (the blade never leaves its slots: it is longer than the gap and both ends stay inside the posts) in the posts where the blade ends hide and bigger saw teeth. Reuses the helpers of idle-plank-saw2-sample.py (everything before its variant C1)."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-plank-saw2-sample.py')).read()
exec(src[:src.index('\n# ---------- C1:')])

BX = 1.65           # where the plate's body starts; the teeth stick out towards -x
BW, BT = 0.24, 0.0      # BT: the blade has no thickness of its own, its outline is the line
_FR_OLD = [(None, None, [2]), (0, 1.8, [2]), (1, 1.8, [0, 2]), (2, 1.8, [0, 1, 2]), (None, 3.0, [0, 1, 2])]   # idle, level 1, 25, 50, done: (phase, log x, blade heights)
_COLS_OLD = ['Idle', 'Level 1: 1 blade', 'Level 25: 2 blades', 'Level 50: 3 blades', 'Done: 4 planks']
_COLS3_OLD = ['Idle', 'Level 1: 1st plank', 'Level 1: 2nd plank', 'Level 1: 3rd plank', 'Done: 4 planks']
SHIFT = {None: 0.0, 0: -0.3, 1: 0.0, 2: 0.3}
POST_Y0, POST_Y1 = 0.3, 2.5     # the posts' inner faces: the blade goes into them
PLATE_LEN = 2.8                 # longer than the gap (2.2) by 0.3 on each side at rest: with a stroke of +-0.3 both ends always stay inside a post
DEPTH, PITCH = 0.17, 0.21


def plate(ox, oy, s, z, depth=DEPTH, pitch=PITCH):
    """The rectangular blade, shifted `s` along y, lying across the belt at height z; the part inside the posts is not drawn. It is as thin as the ink line between stacked planks:
    one flat polygon (its outline is the line), with a ratchet of triangular teeth on the -x edge that moves with it."""
    start = POST_Y0 - (PLATE_LEN - (POST_Y1 - POST_Y0)) / 2 + s
    ya, yb = max(POST_Y0, start), min(POST_Y1, start + PLATE_LEN)
    k0, k1 = int((ya - start) / pitch) - 1, int((yb - start) / pitch) + 1
    cl = lambda y: max(ya, min(yb, y))
    pts = [P(BX, ya, z, ox, oy)]
    for k in range(k0, k1 + 1):
        pts += [P(BX - depth, cl(start + pitch * (k + 0.55)), z, ox, oy), P(BX, cl(start + pitch * (k + 1)), z, ox, oy)]
    pts += [P(BX + BW, yb, z, ox, oy), P(BX + BW, ya, z, ox, oy)]
    poly(pts, STEEL_L, 2.2)


def slot(ox, oy, y, z, depth=DEPTH):
    """The opening in a post's inner face (+y) the blade slides into."""
    x0, x1 = BX - depth - 0.04, BX + BW + 0.04
    poly([P(x0, y, z + BT + 0.025, ox, oy), P(x1, y, z + BT + 0.025, ox, oy), P(x1, y, z - 0.02, ox, oy), P(x0, y, z - 0.02, ox, oy)], '#1f1f1f', 1.4)


def frame_posts(ox, oy, zs, middle, depth=DEPTH):
    """Far post with a slot at each blade height in `zs`, then whatever `middle()` draws between the posts, then the near post and the cross beam."""
    conveyor(ox, oy)
    px0, pw = BX - depth - 0.15, depth + BW + 0.3
    block(px0, 0.0, 0, ox, oy, BLUE, 1, pw, POST_Y0, 2.0)
    for z in zs:
        slot(ox, oy, POST_Y0, z, depth)
    middle()
    block(px0, POST_Y1, 0, ox, oy, BLUE, 1, pw, 0.3, 2.0)
    block(px0, 0.0, 2.0, ox, oy, shade(BLUE, 0.9), 1, pw, POST_Y1 + 0.3, 0.14)
    heap(ox, oy, 2.8, 2.4, 6)


LIFT = 0.02     # a plank that is being cut off rises this much above the blade under it


def blade_h(base, i):
    """Height of the i-th blade (0 = the lowest) of a pass whose uncut log is `base` layers thick: on top of the log, then on top of each plank cut off above it."""
    return CHB + (base + i) * BH + i * LIFT


def alt(ox, oy, spec):
    """spec = (kind, base, m, s). kind 'idle' (no log, blades rest), 'pass' (a log `base` layers thick below the lowest of `m` blades, `m` planks above them, blades shifted by s) or 'done' (four boards out)."""
    kind, base, m, s = spec
    zs = [blade_h(base, i) for i in range(m)]
    def mid():
        if kind == 'done':
            for i in range(4):
                block(3.0, CY - D / 2, CHB + i * (BH + 0.025), ox, oy, MEDIUM, 1, 2.0, D, BH)
        elif kind == 'pass':
            block(0.8, CY - D / 2, CHB, ox, oy, MEDIUM, 1, 2.0, D, BH * base)       # the log is whole below the lowest blade
        for i, z in enumerate(zs):                                                   # blade i lies on the log or on the plank below it; the plank cut off above it comes after
            plate(ox, oy, s, z)
            if kind == 'pass':
                block(0.8, CY - D / 2, z + LIFT, ox, oy, MEDIUM, 1, 2.0, D, BH)
        if kind == 'pass':
            dust(ox, oy, [(BX + 0.5, 1.0, 0.7, 0.2), (BX + 0.5, 1.5, 0.7, 0.2)], 170 + base * 7 + m, 3)
    frame_posts(ox, oy, zs, mid)


# (name, subtitle, [(frame spec, column title)]): the levels' passes. Level 1: 1 blade, 3 passes; level 25: 2 blades, 2 passes (the second one needs only one blade, the other waits retracted in its post);
# level 50: 3 blades, one pass
ROWS = [
    ('Level 1: one blade, three passes', 'the log lies still and is whole below the blade; each pass cuts the top plank off (it lifts a little, then it is gone), 1st, 2nd and 3rd; the last cut leaves the 3rd and 4th plank',
     [(('idle', 3, 1, 0.0), 'Idle'), (('pass', 3, 1, -0.3), 'Pass 1: 1st plank'), (('pass', 2, 1, 0.3), 'Pass 2: 2nd plank'), (('pass', 1, 1, -0.3), 'Pass 3: 3rd plank'), (('done', 3, 1, 0.0), 'Done: 4 planks')]),
    ('Level 25: two blades, two passes', 'the first pass cuts two planks at once (the top one and the one under it), the second pass has one cut left, so one blade works and the other waits in its post',
     [(('idle', 2, 2, 0.0), 'Idle'), (('pass', 2, 2, -0.3), 'Pass 1: 1st and 2nd plank'), (('pass', 1, 1, 0.3), 'Pass 2: 3rd plank'), (('done', 2, 2, 0.0), 'Done: 4 planks')]),
    ('Level 50: three blades, one pass', 'all three cuts at once: the log is whole only below the lowest blade, three planks lift off above the blades and the fourth stays; shown going out and coming back',
     [(('idle', 1, 3, 0.0), 'Idle'), (('pass', 1, 3, -0.3), 'Pass: blades out'), (('pass', 1, 3, 0.3), 'Pass: blades back'), (('done', 1, 3, 0.0), 'Done: 4 planks')]),
]

W, H = 2180, 1290
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" style="width:100%;height:auto;max-width:{W}px">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: the plank saw (row 2) by level: 1, 25 and 50', 28)
for r, (name, sub, frames) in enumerate(ROWS):
    top = 70 + r * 400
    label(30, top + 24, name, 24, 'start')
    label(30, top + 48, sub, 16, 'start', 400)
    for c, (spec, title) in enumerate(frames):
        ox, oy = c * 430 + 190, top + 215
        alt(ox, oy, spec)
        label(ox + 120, top + 380, title, 20, weight=700)
out.append('</svg>')
print('\n'.join(out))
