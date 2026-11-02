import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { TopBar } from './components/TopBar'
import { StatusBar } from './components/StatusBar'
import { EmptyState } from './components/EmptyState'
import { SubtitleEditor } from './features/editor/SubtitleEditor'
import { ChunkMap } from './features/chunkMap/ChunkMap'
import { QADashboard } from './features/qa/QADashboard'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { CharacterReview } from './features/character/CharacterReview'
import { ResumeDialog } from './features/session/ResumeDialog'
import { SyncWizard } from './features/sync/SyncWizard'
import { WorkflowPanel } from './features/workflow/WorkflowPanel'
import { useShortcuts } from './lib/useShortcuts'
import './App.css'

export default function App(): React.JSX.Element {
  const init = useAppStore((s) => s.init)
  const file = useAppStore((s) => s.file)
  const activePanel = useAppStore((s) => s.activePanel)

  useShortcuts()

  useEffect(() => {
    void init()
  }, [init])

  function renderPanel(): React.JSX.Element {
    if (activePanel === 'settings') return <SettingsPanel />
    if (!file) return <EmptyState />
    if (activePanel === 'chunkMap') return <ChunkMap />
    if (activePanel === 'qa') return <QADashboard />
    return <SubtitleEditor />
  }

  return (
    <div className="app">
      <TopBar />
      <main className="app__content">{renderPanel()}</main>
      <StatusBar />
      <CharacterReview />
      <ResumeDialog />
      <SyncWizard />
      <WorkflowPanel />
    </div>
  )
}
