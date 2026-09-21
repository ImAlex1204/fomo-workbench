// Squarified treemap layout (Bruls, Huizing & van Wijk). Items must be sorted by weight, descending.
export type Rect = { x: number; y: number; w: number; h: number }

export function squarify<T extends { weight: number }>(items: T[], rect: Rect): (T & Rect)[] {
  const total = items.reduce((s, i) => s + i.weight, 0)
  if (total <= 0 || items.length === 0) return []
  const out: (T & Rect)[] = []
  let { x, y, w, h } = rect
  let row: T[] = []
  const scale = (w * h) / total
  const worst = (r: T[], side: number) => {
    const sum = r.reduce((s, i) => s + i.weight * scale, 0)
    const max = Math.max(...r.map(i => i.weight * scale)), min = Math.min(...r.map(i => i.weight * scale))
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
  }
  const layoutRow = (r: T[]) => {
    const sum = r.reduce((s, i) => s + i.weight * scale, 0)
    if (w >= h) {  // lay the row out vertically along the left edge
      const rw = sum / h
      let cy = y
      for (const i of r) { const ih = (i.weight * scale) / rw; out.push({ ...i, x, y: cy, w: rw, h: ih }); cy += ih }
      x += rw; w -= rw
    } else {
      const rh = sum / w
      let cx = x
      for (const i of r) { const iw = (i.weight * scale) / rh; out.push({ ...i, x: cx, y, w: iw, h: rh }); cx += iw }
      y += rh; h -= rh
    }
  }
  for (const item of items) {
    const side = Math.min(w, h)
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) row.push(item)
    else { layoutRow(row); row = [item] }
  }
  if (row.length) layoutRow(row)
  return out
}
