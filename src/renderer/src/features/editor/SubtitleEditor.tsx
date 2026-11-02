import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore } from '../../store/useAppStore'
import { SubtitleRow } from './SubtitleRow'
import './SubtitleEditor.css'

const ROW_HEIGHT = 72

export function SubtitleEditor(): React.JSX.Element {
  const subtitles = useAppStore((s) => s.subtitles)
  const updateTranslation = useAppStore((s) => s.updateTranslation)
  const showCps = useAppStore((s) => s.settings?.editor.showCpsWarnings ?? true)

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: subtitles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14
  })

  return (
    <div className={`editor ${showCps ? '' : 'editor--no-cps'}`}>
      <div className="editor__header">
        <div>#</div>
        <div>Timecode</div>
        <div>Original</div>
        <div>Translation</div>
        {showCps && <div title="Characters per second">CPS</div>}
      </div>

      <div className="editor__scroll" ref={parentRef}>
        <div className="editor__sizer" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => {
            const subtitle = subtitles[row.index]
            return (
              <div
                key={row.key}
                className="editor__row-wrap"
                style={{ height: row.size, transform: `translateY(${row.start}px)` }}
              >
                <SubtitleRow subtitle={subtitle} showCps={showCps} onChange={updateTranslation} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
