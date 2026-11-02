import type { ModuleStatusEntry, ProcessingModuleId } from '@shared/types/moduleStatus'
import { useAppStore } from '../store/useAppStore'
import './StatusBar.css'

const MODULE_LABELS: Record<ProcessingModuleId, string> = {
  translate: 'Translate',
  sync: 'Sync',
  gender: 'Gender'
}

const MODULE_ORDER: ProcessingModuleId[] = ['translate', 'sync', 'gender']

function ModulePill({
  id,
  entry,
  onCancel
}: {
  id: ProcessingModuleId
  entry: ModuleStatusEntry
  onCancel?: () => void
}): React.JSX.Element {
  const { state, detail, progress } = entry
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null

  const title = detail ? `${MODULE_LABELS[id]}: ${detail}` : MODULE_LABELS[id]

  return (
    <span className={`statusbar__module statusbar__module--${state}`} title={title}>
      <span className="statusbar__module-label">{MODULE_LABELS[id]}</span>
      {state !== 'idle' && detail && (
        <span className="statusbar__module-detail">{detail}</span>
      )}
      {state === 'running' && pct !== null && (
        <span className="statusbar__module-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
      {onCancel && (
        <button
          type="button"
          className="statusbar__module-cancel"
          onClick={onCancel}
          title="Cancel gender reference scan"
        >
          ✕
        </button>
      )}
    </span>
  )
}

export function StatusBar(): React.JSX.Element {
  const status = useAppStore((s) => s.status)
  const providerStatus = useAppStore((s) => s.providerStatus)
  const file = useAppStore((s) => s.file)
  const moduleStatus = useAppStore((s) => s.moduleStatus)
  const isExtractingGender = useAppStore((s) => s.isExtractingGender)
  const cancelGenderExtraction = useAppStore((s) => s.cancelGenderExtraction)

  const configured = providerStatus.filter((p) => p.hasKey)

  return (
    <footer className="statusbar">
      <div className="statusbar__left">
        <div className="statusbar__modules">
          {MODULE_ORDER.map((id) => (
            <ModulePill
              key={id}
              id={id}
              entry={moduleStatus[id]}
              onCancel={
                id === 'gender' && isExtractingGender && moduleStatus.gender.state === 'running'
                  ? cancelGenderExtraction
                  : undefined
              }
            />
          ))}
        </div>
        <span className={`statusbar__message statusbar__message--${status?.tone ?? 'info'}`}>
          {status?.text ?? 'Ready.'}
        </span>
      </div>

      <div className="statusbar__meta">
        {file && (
          <span className="mono">
            {file.totalSubtitles} lines · {file.duration}
          </span>
        )}
        <span className="statusbar__providers">
          {providerStatus.length === 0 ? (
            '…'
          ) : configured.length === 0 ? (
            <span className="statusbar__providers--none">No API keys</span>
          ) : (
            configured.map((p) => (
              <span key={p.id} className="statusbar__provider" title={`${p.usedToday}/${p.dailyLimit} today`}>
                {p.id}
              </span>
            ))
          )}
        </span>
      </div>
    </footer>
  )
}
