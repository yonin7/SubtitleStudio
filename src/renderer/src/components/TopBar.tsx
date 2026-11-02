import { useAppStore, useTemporalStore, type PanelId } from '../store/useAppStore'
import { Button } from './Button'
import './TopBar.css'

const TABS: { id: PanelId; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'chunkMap', label: 'Chunk Map' },
  { id: 'qa', label: 'QA' },
  { id: 'settings', label: 'Settings' }
]

export function TopBar(): React.JSX.Element {
  const file = useAppStore((s) => s.file)
  const chunks = useAppStore((s) => s.chunks)
  const activePanel = useAppStore((s) => s.activePanel)
  const isTranslating = useAppStore((s) => s.isTranslating)
  const isPreparing = useAppStore((s) => s.isPreparing)
  const isExtractingGender = useAppStore((s) => s.isExtractingGender)
  const glossary = useAppStore((s) => s.glossary)
  const genderRef = useAppStore((s) => s.genderRef)
  const openFile = useAppStore((s) => s.openFile)
  const prepareTranslation = useAppStore((s) => s.prepareTranslation)
  const translateAll = useAppStore((s) => s.translateAll)
  const pause = useAppStore((s) => s.pause)
  const exportSubtitles = useAppStore((s) => s.exportSubtitles)
  const setActivePanel = useAppStore((s) => s.setActivePanel)
  const setSyncOpen = useAppStore((s) => s.setSyncOpen)
  const setWorkflowOpen = useAppStore((s) => s.setWorkflowOpen)
  const isWorkflowRunning = useAppStore((s) => s.isWorkflowRunning)
  const addGenderReference = useAppStore((s) => s.addGenderReference)
  const removeGenderReference = useAppStore((s) => s.removeGenderReference)

  const undo = useTemporalStore((s) => s.undo)
  const redo = useTemporalStore((s) => s.redo)
  const canUndo = useTemporalStore((s) => s.pastStates.length > 0)
  const canRedo = useTemporalStore((s) => s.futureStates.length > 0)

  const completed = chunks.filter((c) => c.status === 'completed').length
  const total = chunks.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const hasWork = total > 0

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">SS</span>
        <div className="topbar__title">
          <strong>SubtitleStudio</strong>
          {file && <span className="topbar__filename mono">{file.filename}</span>}
        </div>
      </div>

      <nav className="topbar__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`topbar__tab ${activePanel === tab.id ? 'is-active' : ''}`}
            onClick={() => setActivePanel(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="topbar__actions">
        {hasWork && (
          <div className="topbar__progress" title={`${completed}/${total} chunks`}>
            <div className="topbar__progress-bar">
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className="topbar__progress-label mono">
              {completed}/{total}
            </span>
          </div>
        )}
        <Button onClick={() => void openFile()} disabled={isTranslating || isWorkflowRunning}>
          Open
        </Button>
        {hasWork && (
          <div className="topbar__group">
            <Button
              variant="primary"
              onClick={() => setWorkflowOpen(true)}
              disabled={isTranslating || isWorkflowRunning || isExtractingGender}
              title="Choose modules: Translate, Sync, Gender — run any combination"
            >
              Workflow
            </Button>
            <Button onClick={() => undo()} disabled={!canUndo || isTranslating || isWorkflowRunning} title="Undo (Ctrl+Z)">
              Undo
            </Button>
            <Button onClick={() => redo()} disabled={!canRedo || isTranslating || isWorkflowRunning} title="Redo (Ctrl+Shift+Z)">
              Redo
            </Button>
            <Button onClick={() => setSyncOpen(true)} disabled={isTranslating || isWorkflowRunning} title="Manual timing tools (shift, scale, fix overlaps)">
              Sync
            </Button>
            {genderRef ? (
              <Button
                onClick={() => removeGenderReference()}
                disabled={isTranslating || isExtractingGender}
                title={`Gender reference: ${genderRef.filename} — ${genderRef.cues.length} cues. Click to remove.`}
              >
                ⚥ {genderRef.cues.length} ✕
              </Button>
            ) : (
              <Button
                onClick={() => void addGenderReference()}
                disabled={isTranslating || isExtractingGender}
                title="Add a parallel gendered-language subtitle (e.g. Arabic/Spanish) to fix Hebrew gender"
              >
                {isExtractingGender ? 'Analysing…' : 'Gender ref'}
              </Button>
            )}
          </div>
        )}
        {hasWork && (
          <Button
            onClick={() => void prepareTranslation()}
            disabled={isTranslating || isPreparing}
            title="Run the Director agent and look up character genders"
          >
            {isPreparing ? 'Preparing…' : glossary?.userReviewed ? '✓ Characters' : 'Characters'}
          </Button>
        )}
        {isTranslating ? (
          <Button variant="danger" onClick={pause}>
            Pause
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => void translateAll()}
            disabled={!hasWork || isWorkflowRunning}
          >
            {completed > 0 && completed < total ? 'Resume' : 'Translate'}
          </Button>
        )}
        <Button onClick={() => void exportSubtitles()} disabled={!hasWork || isTranslating || isWorkflowRunning}>
          Export
        </Button>
      </div>
    </header>
  )
}
