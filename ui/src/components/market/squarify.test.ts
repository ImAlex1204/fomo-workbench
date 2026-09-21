import { describe, expect, it } from 'vitest'
import { squarify, type Rect } from './squarify'

const rect: Rect = { x: 10, y: 20, w: 300, h: 200 }
const items = [50, 30, 10, 5, 3, 2].map((weight, i) => ({ id: i, weight }))  // sorted descending, as required

describe('squarify', () => {
  it('returns [] for no items or zero total weight', () => {
    expect(squarify([], rect)).toEqual([])
    expect(squarify([{ weight: 0 }], rect)).toEqual([])
  })

  it('a single item fills the rectangle', () => {
    const [t] = squarify([{ weight: 7 }], rect)
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(t[k]).toBeCloseTo(rect[k], 9)
  })

  it('preserves total area and makes each area proportional to weight', () => {
    const out = squarify(items, rect)
    const area = rect.w * rect.h
    expect(out).toHaveLength(items.length)
    expect(out.reduce((s, t) => s + t.w * t.h, 0)).toBeCloseTo(area, 6)
    for (const t of out) expect(t.w * t.h).toBeCloseTo((t.weight / 100) * area, 6)
  })

  it('keeps every tile inside the rectangle and carries the item fields through', () => {
    for (const t of squarify(items, rect)) {
      expect(t.x).toBeGreaterThanOrEqual(rect.x - 1e-9)
      expect(t.y).toBeGreaterThanOrEqual(rect.y - 1e-9)
      expect(t.x + t.w).toBeLessThanOrEqual(rect.x + rect.w + 1e-9)
      expect(t.y + t.h).toBeLessThanOrEqual(rect.y + rect.h + 1e-9)
      expect(typeof t.id).toBe('number')
    }
  })
})
