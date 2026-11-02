import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'
import './EmptyState.css'

export function EmptyState(): React.JSX.Element {
  const openFile = useAppStore((s) => s.openFile)

  return (
    <div className="empty">
      <div className="empty__card">
        <div className="empty__icon">SS</div>
        <h1>SubtitleStudio</h1>
        <p>Open a subtitle file to begin translating to Hebrew.</p>
        <p className="empty__formats mono">SRT · VTT · ASS · SSA</p>
        <Button variant="primary" onClick={() => void openFile()}>
          Open subtitle file
        </Button>
      </div>
    </div>
  )
}
