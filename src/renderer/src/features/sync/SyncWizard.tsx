import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../../components/Button'
import './SyncWizard.css'

const FRAMERATES = [
  { label: '23.976 (NTSC film)', value: 23.976 },
  { label: '24 (film)', value: 24 },
  { label: '25 (PAL)', value: 25 },
  { label: '29.97 (NTSC)', value: 29.97 },
  { label: '30', value: 30 }
]

export function SyncWizard(): React.JSX.Element | null {
  const isOpen = useAppStore((s) => s.isSyncOpen)
  const setSyncOpen = useAppStore((s) => s.setSyncOpen)
  const shiftAll = useAppStore((s) => s.shiftAll)
  const scaleAll = useAppStore((s) => s.scaleAll)
  const fixTimings = useAppStore((s) => s.fixTimings)

  const [shiftMs, setShiftMs] = useState(0)
  const [fromFps, setFromFps] = useState(23.976)
  const [toFps, setToFps] = useState(25)

  if (!isOpen) return null

  const close = (): void => setSyncOpen(false)
  const factor = fromFps / toFps

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="sync" onClick={(e) => e.stopPropagation()}>
        <header className="sync__head">
          <h2>Timing Sync Wizard</h2>
          <button className="sync__close" onClick={close} aria-label="Close">
            ×
          </button>
        </header>

        <section className="sync__section">
          <h3>Shift all timings</h3>
          <p className="sync__hint">Move every subtitle earlier (−) or later (+).</p>
          <div className="sync__row">
            <input
              type="number"
              step={100}
              value={shiftMs}
              onChange={(e) => setShiftMs(Number(e.target.value))}
            />
            <span className="sync__unit">ms</span>
            <Button onClick={() => shiftAll(shiftMs)} disabled={!shiftMs}>
              Apply shift
            </Button>
          </div>
        </section>

        <section className="sync__section">
          <h3>Framerate conversion</h3>
          <p className="sync__hint">Rescale timings when source and target framerates differ.</p>
          <div className="sync__row">
            <label>
              From
              <select value={fromFps} onChange={(e) => setFromFps(Number(e.target.value))}>
                {FRAMERATES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To
              <select value={toFps} onChange={(e) => setToFps(Number(e.target.value))}>
                {FRAMERATES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => scaleAll(factor)} disabled={factor === 1}>
              Rescale (×{factor.toFixed(4)})
            </Button>
          </div>
        </section>

        <section className="sync__section">
          <h3>Auto-fix</h3>
          <p className="sync__hint">Resolve common timing problems in one click.</p>
          <div className="sync__row sync__row--wrap">
            <Button variant="subtle" onClick={() => fixTimings('overlaps')}>
              Fix overlaps
            </Button>
            <Button variant="subtle" onClick={() => fixTimings('short')}>
              Extend short cues
            </Button>
            <Button variant="subtle" onClick={() => fixTimings('both')}>
              Fix both
            </Button>
          </div>
        </section>

        <footer className="sync__foot">
          <span className="sync__hint">All changes are undoable (Ctrl+Z).</span>
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </footer>
      </div>
    </div>
  )
}
