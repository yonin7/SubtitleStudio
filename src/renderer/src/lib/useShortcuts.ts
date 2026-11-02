import { useEffect } from 'react'
import { useAppStore, type PanelId } from '../store/useAppStore'

const PANEL_BY_DIGIT: Record<string, PanelId> = {
  '1': 'editor',
  '2': 'chunkMap',
  '3': 'qa',
  '4': 'settings'
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Global keyboard shortcuts. Reads actions lazily so it mounts once. */
export function useShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      const store = useAppStore.getState()
      const editable = isEditable(e.target)
      const key = e.key.toLowerCase()

      // Always-available, non-conflicting commands.
      if (key === 'o') {
        e.preventDefault()
        if (!store.isTranslating) void store.openFile()
        return
      }
      if (key === 'e') {
        e.preventDefault()
        if (store.file && !store.isTranslating) void store.exportSubtitles()
        return
      }
      if (key === 'enter') {
        e.preventDefault()
        if (store.isTranslating) store.pause()
        else if (store.chunks.length) void store.translateAll()
        return
      }

      // Editing commands — defer to native behaviour while typing.
      if (editable) return

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useAppStore.temporal.getState().undo()
        return
      }
      if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useAppStore.temporal.getState().redo()
        return
      }
      if (PANEL_BY_DIGIT[e.key]) {
        e.preventDefault()
        store.setActivePanel(PANEL_BY_DIGIT[e.key])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
