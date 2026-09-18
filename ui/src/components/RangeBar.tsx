import { RANGES, type Range } from '../api'

export default function RangeBar({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex gap-0.5 rounded-md border border-line p-0.5">
      {(Object.keys(RANGES) as Range[]).map(r => (
        <button key={r} onClick={() => onChange(r)}
          className={`num rounded px-2 py-0.5 text-[11px] ${value === r ? 'bg-panel-2 text-ink' : 'text-ink-3 hover:text-ink-2'}`}>{r}</button>
      ))}
    </div>
  )
}
