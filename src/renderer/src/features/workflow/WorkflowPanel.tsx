import { useAppStore } from '../../store/useAppStore'
import { Button } from '../../components/Button'
import type { TimingSource, WorkflowModuleId, WorkflowPlan } from '@shared/types'
import './WorkflowPanel.css'

const MODULES: { id: WorkflowModuleId; label: string; hint: string }[] = [
  {
    id: 'translate',
    label: 'Translate',
    hint: 'Source language → Hebrew (uses glossary & style guide when set)'
  },
  {
    id: 'sync',
    label: 'Sync timings',
    hint: 'Adopt timecodes from the gender-reference file (overlap alignment)'
  },
  {
    id: 'gender',
    label: 'Gender fix',
    hint: 'Correct Hebrew gender on existing translations (no re-translation)'
  }
]

function toggleModule(plan: WorkflowPlan, id: WorkflowModuleId): WorkflowPlan {
  const has = plan.modules.includes(id)
  const modules = has ? plan.modules.filter((m) => m !== id) : [...plan.modules, id]
  return { ...plan, modules }
}

export function WorkflowPanel(): React.JSX.Element | null {
  const isOpen = useAppStore((s) => s.isWorkflowOpen)
  const setWorkflowOpen = useAppStore((s) => s.setWorkflowOpen)
  const plan = useAppStore((s) => s.workflowPlan)
  const setWorkflowPlan = useAppStore((s) => s.setWorkflowPlan)
  const runWorkflow = useAppStore((s) => s.runWorkflow)
  const isRunning = useAppStore((s) => s.isWorkflowRunning)
  const genderRef = useAppStore((s) => s.genderRef)
  const subtitles = useAppStore((s) => s.subtitles)
  const hasTranslation = subtitles.some((s) => s.translation.trim() !== '')

  if (!isOpen) return null

  const syncNeedsRef = plan.modules.includes('sync') && plan.timingSource === 'reference'
  const canRun =
    plan.modules.length > 0 &&
    (!plan.modules.includes('gender') || (genderRef?.cues.length && hasTranslation)) &&
    (!(
      plan.modules.includes('sync') && plan.timingSource === 'reference'
    ) ||
      (genderRef?.timings?.length ?? 0) > 0)

  const warnings: string[] = []
  if (plan.modules.includes('translate') && plan.modules.includes('gender') && !genderRef) {
    warnings.push('Gender fix works best with a reference file loaded first.')
  }
  if (syncNeedsRef && !genderRef?.timings?.length) {
    warnings.push('Sync from reference requires a gender-reference file (timings).')
  }
  if (plan.modules.includes('gender') && !hasTranslation) {
    warnings.push('Gender fix needs existing Hebrew translations (translate first or load a session).')
  }
  if (plan.modules.includes('gender') && !plan.modules.includes('translate') && !genderRef?.cues.length) {
    warnings.push('Load a gender reference and wait for cue extraction.')
  }

  return (
    <div className="modal-overlay" onClick={() => setWorkflowOpen(false)}>
      <div className="workflow" onClick={(e) => e.stopPropagation()}>
        <header className="workflow__head">
          <h2>Processing workflow</h2>
          <button className="workflow__close" onClick={() => setWorkflowOpen(false)} aria-label="Close">
            ×
          </button>
        </header>

        <p className="workflow__intro">
          Pick one or more modules — each runs independently or in sequence: Sync → Translate → Gender.
        </p>

        <div className="workflow__modules">
          {MODULES.map((mod) => (
            <label key={mod.id} className="workflow__module">
              <input
                type="checkbox"
                checked={plan.modules.includes(mod.id)}
                onChange={() => setWorkflowPlan(toggleModule(plan, mod.id))}
              />
              <span>
                <strong>{mod.label}</strong>
                <span className="workflow__hint">{mod.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {plan.modules.includes('sync') && (
          <fieldset className="workflow__fieldset">
            <legend>Timing source for output</legend>
            <label className="workflow__radio">
              <input
                type="radio"
                name="timingSource"
                checked={plan.timingSource === 'primary'}
                onChange={() => setWorkflowPlan({ ...plan, timingSource: 'primary' as TimingSource })}
              />
              Keep primary file timings
            </label>
            <label className="workflow__radio">
              <input
                type="radio"
                name="timingSource"
                checked={plan.timingSource === 'reference'}
                onChange={() => setWorkflowPlan({ ...plan, timingSource: 'reference' as TimingSource })}
                disabled={!genderRef}
              />
              Use gender-reference file timings
              {!genderRef && <span className="workflow__hint"> — load a reference first</span>}
            </label>
          </fieldset>
        )}

        {genderRef && (
          <p className="workflow__ref mono">
            Reference: {genderRef.filename} · {genderRef.cues.length} gender cues ·{' '}
            {genderRef.timings.length} timing rows
          </p>
        )}

        {warnings.length > 0 && (
          <ul className="workflow__warnings">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <footer className="workflow__foot">
          <Button variant="subtle" onClick={() => setWorkflowOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canRun || isRunning}
            onClick={() => void runWorkflow()}
          >
            {isRunning ? 'Running…' : 'Run selected'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
