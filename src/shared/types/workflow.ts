/** Independent processing modules the user can run alone or in any combination. */
export type WorkflowModuleId = 'translate' | 'sync' | 'gender'

/** Which file's timecodes become the output when Sync is enabled. */
export type TimingSource = 'primary' | 'reference'

/**
 * A user-selected processing plan. Each module is self-contained:
 *   translate — source → target (optional gender hints if a reference is loaded)
 *   sync      — adopt timings from the reference file (overlap alignment)
 *   gender    — fix Hebrew gender conjugation on existing translations (no re-translation)
 */
export interface WorkflowPlan {
  modules: WorkflowModuleId[]
  timingSource: TimingSource
}

export const EMPTY_WORKFLOW_PLAN: WorkflowPlan = {
  modules: [],
  timingSource: 'primary'
}

/** Default plan for a full first-time pass. */
export const DEFAULT_WORKFLOW_PLAN: WorkflowPlan = {
  modules: ['translate'],
  timingSource: 'primary'
}
