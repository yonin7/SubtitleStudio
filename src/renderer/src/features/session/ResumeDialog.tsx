import { useAppStore } from '../../store/useAppStore'
import { Button } from '../../components/Button'
import './ResumeDialog.css'

export function ResumeDialog(): React.JSX.Element | null {
  const pending = useAppStore((s) => s.pendingResume)
  const applyResume = useAppStore((s) => s.applyResume)
  const discardResume = useAppStore((s) => s.discardResume)

  if (!pending) return null

  const done = pending.chunks.filter((c) => c.status === 'completed').length

  return (
    <div className="modal-overlay">
      <div className="resume">
        <h2>Resume translation?</h2>
        <p>
          Found an in-progress session for <strong>{pending.filename}</strong>.
        </p>
        <p className="resume__meta mono">
          {done}/{pending.totalChunks} chunks completed · saved{' '}
          {new Date(pending.updatedAt).toLocaleString()}
        </p>
        <div className="resume__actions">
          <Button variant="subtle" onClick={() => void discardResume()}>
            Start over
          </Button>
          <Button variant="primary" onClick={applyResume}>
            Resume
          </Button>
        </div>
      </div>
    </div>
  )
}
