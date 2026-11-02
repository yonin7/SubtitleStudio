import { memo } from 'react'
import type { Subtitle } from '@shared/types'

interface SubtitleRowProps {
  subtitle: Subtitle
  showCps: boolean
  onChange: (id: number, text: string) => void
}

export const SubtitleRow = memo(function SubtitleRow({
  subtitle,
  showCps,
  onChange
}: SubtitleRowProps): React.JSX.Element {
  return (
    <div className={`srow srow--${subtitle.status}`}>
      <div className="srow__id mono">{subtitle.id}</div>
      <div className="srow__time mono">
        <span>{subtitle.start}</span>
        <span>{subtitle.end}</span>
      </div>
      <div className="srow__original">{subtitle.original}</div>
      <textarea
        className="srow__translation rtl"
        dir="rtl"
        spellCheck={false}
        value={subtitle.translation}
        placeholder="—"
        onChange={(e) => onChange(subtitle.id, e.target.value)}
      />
      {showCps && (
        <div className={`srow__cps mono ${subtitle.cpsWarning ? 'is-warning' : ''}`}>
          {subtitle.cps || ''}
        </div>
      )}
    </div>
  )
})
