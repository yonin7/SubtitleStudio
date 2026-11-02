import { useAppStore } from '../../store/useAppStore'
import type { ChunkStatus } from '@shared/types'
import './ChunkMap.css'

const LEGEND: { status: ChunkStatus; label: string }[] = [
  { status: 'completed', label: 'Completed' },
  { status: 'active', label: 'Active' },
  { status: 'failed', label: 'Failed' },
  { status: 'skipped', label: 'Skipped' },
  { status: 'pending', label: 'Pending' }
]

export function ChunkMap(): React.JSX.Element {
  const chunks = useAppStore((s) => s.chunks)
  const subtitles = useAppStore((s) => s.subtitles)
  const isTranslating = useAppStore((s) => s.isTranslating)
  const retranslateChunk = useAppStore((s) => s.retranslateChunk)
  const translateFrom = useAppStore((s) => s.translateFrom)
  const toggleSkipChunk = useAppStore((s) => s.toggleSkipChunk)

  function handleClick(e: React.MouseEvent, chunkId: number): void {
    if (e.altKey) toggleSkipChunk(chunkId)
    else if (e.shiftKey) void translateFrom(chunkId)
    else void retranslateChunk(chunkId)
  }

  return (
    <div className="chunkmap">
      <div className="chunkmap__legend">
        {LEGEND.map((item) => (
          <span key={item.status} className="chunkmap__legend-item">
            <i className={`chunkcell chunkcell--${item.status}`} />
            {item.label}
          </span>
        ))}
        <span className="chunkmap__hint">
          Click to (re)translate · Shift+Click to translate from here · Alt+Click to skip/unskip
        </span>
      </div>

      <div className="chunkmap__grid">
        {chunks.map((chunk) => {
          const fromId = subtitles[chunk.startIndex]?.id ?? '?'
          const toId = subtitles[chunk.endIndex]?.id ?? '?'
          const tip = `Chunk ${chunk.id} · lines ${fromId}–${toId} · ${chunk.status}${
            chunk.error ? ` · ${chunk.error}` : ''
          }`
          return (
            <button
              key={chunk.id}
              className={`chunkcell chunkcell--${chunk.status} ${chunk.status === 'active' ? 'is-pulsing' : ''}`}
              title={tip}
              disabled={isTranslating}
              onClick={(e) => handleClick(e, chunk.id)}
            >
              {chunk.id}
            </button>
          )
        })}
      </div>
    </div>
  )
}
