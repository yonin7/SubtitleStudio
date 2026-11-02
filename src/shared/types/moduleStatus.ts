/** Per-module run state shown in the status bar. */
export type ModuleRunState = 'idle' | 'running' | 'done' | 'error'

export type ProcessingModuleId = 'translate' | 'sync' | 'gender'

export interface ModuleProgress {
  current: number
  total: number
}

export interface ModuleStatusEntry {
  state: ModuleRunState
  /** Short label, e.g. "chunk 3/12" or "analysing window 5/8". */
  detail: string
  progress: ModuleProgress | null
}

export type ModuleStatusMap = Record<ProcessingModuleId, ModuleStatusEntry>

export const IDLE_MODULE_STATUS: ModuleStatusEntry = {
  state: 'idle',
  detail: '',
  progress: null
}

export function emptyModuleStatusMap(): ModuleStatusMap {
  return {
    translate: { ...IDLE_MODULE_STATUS },
    sync: { ...IDLE_MODULE_STATUS },
    gender: { ...IDLE_MODULE_STATUS }
  }
}
