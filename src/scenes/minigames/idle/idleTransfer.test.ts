import { describe, expect, it } from 'vitest';
import { AISLES, slotRect } from './idleLayout';
import { TRANSFER_SPEED, routeLength, routePoint, transferRoute, transferS } from './idleTransfer';

describe('the conveyor between a saw 1 and the saw 2 of its column', () => {
  it('is a straight line along gx on the lane of the slot, from the end of the saw 1 to the start of the saw 2, across the aisle', () => {
    for (const slot of [0, 1, 2] as const) {
      const r = transferRoute(slot), a = slotRect(1, slot), b = slotRect(2, slot);
      expect(r).toHaveLength(2);
      expect(r[0].gy).toBe(r[1].gy);
      expect(r[0].gy).toBeGreaterThan(a.gy0);
      expect(r[0].gy).toBeLessThan(a.gy1 + 1);
      expect(r[0].gx).toBeGreaterThan(a.gx0);
      expect(r[0].gx).toBeLessThan(a.gx1 + 1);
      expect(r[1].gx).toBeGreaterThan(AISLES.f3.gx1);
      expect(r[1].gx).toBeLessThan(b.gx0 + 0.1);
    }
  });
  it('takes the same time in every column: its length over the speed', () => {
    expect(routeLength(transferRoute(0))).toBeCloseTo(routeLength(transferRoute(2)));
    expect(transferS(1)).toBeCloseTo(routeLength(transferRoute(1)) / TRANSFER_SPEED);
    expect(transferS(0)).toBeGreaterThan(1);
  });
  it('puts the log at the start, at the end and in between', () => {
    const r = transferRoute(1), n = routeLength(r);
    expect(routePoint(r, 0)).toEqual(r[0]);
    expect(routePoint(r, n)).toEqual(r[1]);
    expect(routePoint(r, n + 5)).toEqual(r[1]);
    expect(routePoint(r, -1)).toEqual(r[0]);
    const mid = routePoint(r, n / 2);
    expect(mid.gx).toBeGreaterThan(r[0].gx);
    expect(mid.gx).toBeLessThan(r[1].gx);
    expect(mid.gy).toBe(r[0].gy);
  });
});
