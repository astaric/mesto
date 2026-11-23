#!/usr/bin/env python3
"""Generates idle-logsaw-shuttle-sample.svg: the log saw as one fixed circular saw; the trunk shuttles through it (forward = a cut), comes back and turns a quarter ON ITS OWN
(no turntable: the belt's rollers roll it), four times. Run: python3 docs/minigames/idle-logsaw-shuttle-sample.py > docs/minigames/idle-logsaw-shuttle-sample.svg
Reuses the helpers of idle-logsaw1-sample.py (everything before its variant A)."""
import os, math, random
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'idle-logsaw1-sample.py')).read()
exec(src[:src.index('# ---------- A:')])

SX = 2.0


def turn_arrow(ox, oy, xc, col=INK):
    """A curved arrow round the trunk: it is rolling a quarter turn."""
    cz = CH + R
    pts = [P(xc, CY + 0.5 * math.cos(a), cz + 0.5 * math.sin(a), ox, oy) for a in [0.2 + i * 0.12 for i in range(11)]]
    for p, q in zip(pts, pts[1:]):
        line(p, q, col, 3.2)
    a = 0.2 + 10 * 0.12
    tip = P(xc, CY + 0.5 * math.cos(a + 0.2), cz + 0.5 * math.sin(a + 0.2), ox, oy)
    for d in (-0.35, 0.35):
        line(tip, P(xc, CY + 0.38 * math.cos(a - 0.05 + d * 0.5), cz + 0.38 * math.sin(a - 0.05 + d * 0.5), ox, oy), col, 3.2)


def rollers(ox, oy, glow):
    """The belt has rollers under the trunk's resting place; they spin it."""
    for i in range(5):
        x = -0.2 + i * 0.18
        block(x, CY - 0.3, CH, ox, oy, ORANGE if glow else STEEL_D, 1, 0.1, 0.6, 0.03)


def frame(ox, oy, kind, k):
    """kind: idle | cut | turn | done; k = how many cuts have been made (cut: the one being made)."""
    conveyor(ox, oy)
    block(1.65, 0.1, 0, ox, oy, BLUE, 1, 0.7, 0.45, 1.9)                         # frame behind the saw
    block(1.8, 0.55, 1.25, ox, oy, STEEL_D, 1, 0.4, 0.45, 0.3)                   # arbor
    toothed(SAW_Y, SX, 1.4, 0.95, ox, oy, (k % 4) * 0.5 if kind == 'cut' else 0)
    block(1.65, 0.1, 1.9, ox, oy, shade(BLUE, 0.9), 1, 0.7, 0.45, 0.2)           # hood
    slabs(ox, oy, k if kind in ('cut', 'turn', 'done') else 0, 2.35, 3.1, 0.35)
    if kind == 'cut':
        xs = 0.9 + 0.08 * k
        extrude(xs, SX, ox, oy, flats_after(k)[1:])
        extrude(SX, xs + 2.0, ox, oy, flats_after(k))
        dust(ox, oy, [(2.15, 0.85, 0.7, 0.2), (2.3, 0.7, 0.2, 0.25)], 80 + k, 4)
        arrow(ox, oy, 0.2, 0.8, 2.15, 0.15)
    elif kind == 'turn':                                                        # back at the start; the flats have moved a quarter round
        rollers(ox, oy, True)
        extrude(-0.4, 1.6, ox, oy, flats_after(k + 1)[1:])
        turn_arrow(ox, oy, 0.6)
        arrow(ox, oy, 0.8, 0.2, 2.15, 0.15)
    elif kind == 'done':
        extrude(3.0, 5.0, ox, oy, flats_after(4))


FRAMES = [('idle', 0, 'Idle'), ('cut', 1, 'Cut 1: forward'), ('turn', 1, 'Back, turns itself'), ('cut', 2, 'Cut 2'), ('turn', 2, 'Back, turns itself'),
          ('cut', 3, 'Cut 3'), ('turn', 3, 'Back, turns itself'), ('cut', 4, 'Cut 4'), ('done', 4, 'Done: square log goes out')]

W, H = 2180, 920
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
out.append(f'<rect width="{W}" height="{H}" fill="#a9c97a"/>')
label(W / 2, 44, 'Idle sawmill: one fixed circular saw, the trunk shuttles through it and turns itself between cuts', 26)
label(30, 84, 'one pass = forward through the saw (a flat is cut on the far side), back, a quarter roll on the belt; four passes make the square log. Slabs fall behind the saw.', 17, 'start', 400)
for i, (kind, k, name) in enumerate(FRAMES):
    r, c = divmod(i, 5)
    ox, oy = c * 430 + 190, 100 + r * 400 + 215
    frame(ox, oy, kind, k)
    label(ox + 120, 100 + r * 400 + 380, name, 20, weight=700)
out.append('</svg>')
print('\n'.join(out))
