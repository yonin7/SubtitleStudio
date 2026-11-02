import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../../components/Button'
import type { KeyProviderId } from '@shared/types'
import './ApiKeyManager.css'

const LABELS: Record<KeyProviderId, string> = {
  gemini: 'Google Gemini',
  groq: 'Groq',
  tmdb: 'TMDB (optional)'
}

export function ApiKeyManager(): React.JSX.Element {
  const apiKeys = useAppStore((s) => s.apiKeys)
  const addApiKey = useAppStore((s) => s.addApiKey)
  const removeApiKey = useAppStore((s) => s.removeApiKey)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const submit = (provider: KeyProviderId): void => {
    const value = (drafts[provider] ?? '').trim()
    if (!value) return
    void addApiKey(provider, value)
    setDrafts((d) => ({ ...d, [provider]: '' }))
  }

  return (
    <div className="keys">
      {apiKeys.map((info) => (
        <div key={info.provider} className="keys__provider">
          <div className="keys__head">
            <span className="keys__name">{LABELS[info.provider]}</span>
            {info.envCount > 0 && (
              <span className="keys__env mono">
                {info.envCount} from .env
              </span>
            )}
          </div>

          {info.stored.length > 0 && (
            <ul className="keys__list">
              {info.stored.map((masked, i) => (
                <li key={`${info.provider}-${i}`} className="keys__item">
                  <span className="mono">{masked}</span>
                  <button
                    className="keys__remove"
                    title="Remove key"
                    onClick={() => void removeApiKey(info.provider, i)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="keys__add">
            <input
              type="password"
              placeholder={`Add a ${LABELS[info.provider]} key…`}
              value={drafts[info.provider] ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [info.provider]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(info.provider)
              }}
            />
            <Button onClick={() => submit(info.provider)}>Add</Button>
          </div>
        </div>
      ))}
    </div>
  )
}
