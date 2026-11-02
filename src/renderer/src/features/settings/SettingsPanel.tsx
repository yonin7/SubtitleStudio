import { useAppStore } from '../../store/useAppStore'
import { Button } from '../../components/Button'
import { ApiKeyManager } from './ApiKeyManager'
import type { AIProviderId, ExportFormat } from '@shared/types'
import './SettingsPanel.css'

export function SettingsPanel(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const providerStatus = useAppStore((s) => s.providerStatus)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const resetSettings = useAppStore((s) => s.resetSettings)
  const refreshProviderStatus = useAppStore((s) => s.refreshProviderStatus)

  if (!settings) return <div className="settings settings--loading">Loading settings…</div>

  return (
    <div className="settings">
      <section className="settings__section">
        <h2>API Providers</h2>
        <p className="settings__hint">
          Keys are read from a local <span className="mono">.env</span> file in the main process and
          never exposed to the UI.
        </p>
        <div className="settings__providers">
          {providerStatus.map((p) => (
            <div key={p.id} className="provider-card">
              <div className="provider-card__head">
                <span className="mono">{p.id}</span>
                <span className={`provider-card__badge ${p.hasKey ? 'is-on' : 'is-off'}`}>
                  {p.hasKey ? (p.keyCount > 1 ? `${p.keyCount} keys` : 'Key set') : 'No key'}
                </span>
              </div>
              <div className="provider-card__usage mono">
                {p.usedToday}/{p.dailyLimit} today
              </div>
              {p.lastError && <div className="provider-card__error">{p.lastError}</div>}
            </div>
          ))}
        </div>
        <div className="settings__actions">
          <Button onClick={() => void refreshProviderStatus()}>Refresh status</Button>
          <Button
            variant="subtle"
            onClick={() => {
              if (window.confirm('Reset all settings to their defaults?')) void resetSettings()
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </section>

      <section className="settings__section">
        <h2>API Keys</h2>
        <p className="settings__hint">
          Add multiple keys per provider to multiply the free daily quota — the app rotates to the
          next key automatically when one is exhausted. Keys are stored locally and never leave your
          machine.
        </p>
        <ApiKeyManager />
      </section>

      <section className="settings__section">
        <h2>Translation</h2>
        <div className="settings__grid">
          <label className="field">
            <span>Target language</span>
            <input
              value={settings.translation.defaultTargetLang}
              onChange={(e) =>
                void saveSettings({ translation: { ...settings.translation, defaultTargetLang: e.target.value } })
              }
            />
          </label>
          <label className="field">
            <span>Preferred provider</span>
            <select
              value={settings.api.preferredProvider}
              onChange={(e) =>
                void saveSettings({ api: { ...settings.api, preferredProvider: e.target.value as AIProviderId } })
              }
            >
              <option value="gemini-flash-lite">gemini-flash-lite</option>
              <option value="groq">groq</option>
              <option value="gemini-flash">gemini-flash</option>
            </select>
          </label>
          <label className="field">
            <span>Batch delay (ms)</span>
            <input
              type="number"
              min={0}
              value={settings.api.batchDelay}
              onChange={(e) =>
                void saveSettings({ api: { ...settings.api, batchDelay: Number(e.target.value) } })
              }
            />
          </label>
          <label className="field">
            <span>Max retries</span>
            <input
              type="number"
              min={0}
              value={settings.api.maxRetries}
              onChange={(e) =>
                void saveSettings({ api: { ...settings.api, maxRetries: Number(e.target.value) } })
              }
            />
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={settings.translation.runDirectorAgent}
              onChange={(e) =>
                void saveSettings({
                  translation: { ...settings.translation, runDirectorAgent: e.target.checked }
                })
              }
            />
            <span>Run Director agent (style guide)</span>
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={settings.translation.runReviewerAgent}
              onChange={(e) =>
                void saveSettings({
                  translation: { ...settings.translation, runReviewerAgent: e.target.checked }
                })
              }
            />
            <span>Run Reviewer agent (QA)</span>
          </label>
          <label className="field">
            <span>Reviewer frequency (chunks)</span>
            <input
              type="number"
              min={1}
              value={settings.translation.reviewerFrequency}
              onChange={(e) =>
                void saveSettings({
                  translation: { ...settings.translation, reviewerFrequency: Number(e.target.value) }
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="settings__section">
        <h2>Chunks</h2>
        <div className="settings__grid">
          <label className="field">
            <span>Chunk size</span>
            <input
              type="number"
              min={5}
              max={30}
              value={settings.chunks.defaultChunkSize}
              onChange={(e) =>
                void saveSettings({ chunks: { ...settings.chunks, defaultChunkSize: Number(e.target.value) } })
              }
            />
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={settings.chunks.respectSceneBreaks}
              onChange={(e) =>
                void saveSettings({ chunks: { ...settings.chunks, respectSceneBreaks: e.target.checked } })
              }
            />
            <span>Respect scene breaks</span>
          </label>
        </div>
      </section>

      <section className="settings__section">
        <h2>Editor &amp; Export</h2>
        <div className="settings__grid">
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={settings.editor.showCpsWarnings}
              onChange={(e) =>
                void saveSettings({ editor: { ...settings.editor, showCpsWarnings: e.target.checked } })
              }
            />
            <span>Show CPS warnings</span>
          </label>
          <label className="field">
            <span>Export format</span>
            <select
              value={settings.export.defaultFormat}
              onChange={(e) =>
                void saveSettings({ export: { ...settings.export, defaultFormat: e.target.value as ExportFormat } })
              }
            >
              <option value="srt">SRT</option>
              <option value="vtt">VTT</option>
              <option value="txt">TXT</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={settings.export.rtlOverride}
              onChange={(e) =>
                void saveSettings({ export: { ...settings.export, rtlOverride: e.target.checked } })
              }
            />
            <span>RTL override on export</span>
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={settings.export.addBom}
              onChange={(e) =>
                void saveSettings({ export: { ...settings.export, addBom: e.target.checked } })
              }
            />
            <span>Add UTF-8 BOM</span>
          </label>
        </div>
      </section>
    </div>
  )
}
