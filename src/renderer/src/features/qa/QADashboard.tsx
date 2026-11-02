import { useAppStore } from '../../store/useAppStore'
import { Button } from '../../components/Button'
import './QADashboard.css'

export function QADashboard(): React.JSX.Element {
  const issues = useAppStore((s) => s.qaIssues)
  const score = useAppStore((s) => s.qaScore)
  const runReviewer = useAppStore((s) => s.settings?.translation.runReviewerAgent ?? false)
  const applyQaFix = useAppStore((s) => s.applyQaFix)
  const dismissQaIssue = useAppStore((s) => s.dismissQaIssue)

  return (
    <div className="qa">
      <header className="qa__head">
        <h2>Quality Assurance</h2>
        {score !== null && (
          <span className="qa__score" title="Latest reviewer score">
            Score: {score}
          </span>
        )}
        <span className="qa__count">{issues.length} open issue(s)</span>
      </header>

      {!runReviewer && (
        <p className="qa__hint">
          The Reviewer agent is disabled. Enable it in Settings to automatically QA every few
          chunks during translation.
        </p>
      )}

      {issues.length === 0 ? (
        <p className="qa__empty">No issues found. Translate with the Reviewer enabled to populate this report.</p>
      ) : (
        <div className="qa__list">
          {issues.map((issue, idx) => (
            <div key={`${issue.subtitle_id}-${issue.type}-${idx}`} className="qa__issue">
              <div className="qa__issue-head">
                <span className="mono qa__issue-id">#{issue.subtitle_id}</span>
                <span className={`qa__type qa__type--${issue.type}`}>{issue.type.replace('_', ' ')}</span>
                <span className="qa__desc">{issue.description}</span>
              </div>
              <div className="qa__diff">
                <div className="qa__diff-col">
                  <span className="qa__diff-label">Current</span>
                  <span className="rtl qa__diff-text">{issue.current_text}</span>
                </div>
                <div className="qa__diff-col">
                  <span className="qa__diff-label">Suggested</span>
                  <span className="rtl qa__diff-text qa__diff-text--fix">{issue.suggested_fix}</span>
                </div>
              </div>
              <div className="qa__actions">
                <Button variant="subtle" onClick={() => dismissQaIssue(issue)}>
                  Dismiss
                </Button>
                <Button
                  variant="primary"
                  disabled={!issue.suggested_fix}
                  onClick={() => applyQaFix(issue)}
                >
                  Apply fix
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
