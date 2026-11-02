import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../../components/Button'
import type { Gender } from '@shared/types'
import './CharacterReview.css'

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'm', label: 'Male (זכר)' },
  { value: 'f', label: 'Female (נקבה)' },
  { value: 'neutral', label: 'Neutral' }
]

export function CharacterReview(): React.JSX.Element | null {
  const review = useAppStore((s) => s.review)
  const updateCharacter = useAppStore((s) => s.updateReviewCharacter)
  const addCharacter = useAppStore((s) => s.addReviewCharacter)
  const removeCharacter = useAppStore((s) => s.removeReviewCharacter)
  const setTerm = useAppStore((s) => s.setReviewTerm)
  const removeTerm = useAppStore((s) => s.removeReviewTerm)
  const confirmReview = useAppStore((s) => s.confirmReview)
  const cancelReview = useAppStore((s) => s.cancelReview)

  const [newName, setNewName] = useState('')
  const [termFrom, setTermFrom] = useState('')
  const [termTo, setTermTo] = useState('')

  if (!review) return null

  const unresolved = review.characters.filter((c) => c.gender === 'unknown').length
  const canConfirm = unresolved === 0

  function submitCharacter(): void {
    addCharacter(newName)
    setNewName('')
  }

  function submitTerm(): void {
    if (!termFrom.trim()) return
    setTerm(termFrom, termTo)
    setTermFrom('')
    setTermTo('')
  }

  return (
    <div className="modal-overlay" onClick={cancelReview}>
      <div className="cr" onClick={(e) => e.stopPropagation()}>
        <header className="cr__head">
          <div>
            <h2>Character Review</h2>
            <p className="cr__sub">
              {review.title} · source: <span className="mono">{review.source}</span>
            </p>
          </div>
          {unresolved > 0 && (
            <span className="cr__warn">{unresolved} character(s) need a gender</span>
          )}
        </header>

        <div className="cr__body">
          <div className="cr__chars">
            {review.characters.length === 0 && (
              <p className="cr__empty">No characters yet. Add the key speaking characters below.</p>
            )}
            {review.characters.map((c) => (
              <div
                key={c.original}
                className={`cr__row ${c.gender === 'unknown' ? 'is-unresolved' : ''}`}
              >
                {c.imageUrl ? (
                  <img className="cr__avatar" src={c.imageUrl} alt="" />
                ) : (
                  <div className="cr__avatar cr__avatar--blank">{c.original.charAt(0)}</div>
                )}
                <div className="cr__names">
                  <span className="cr__orig">{c.original}</span>
                  {c.role && <span className="cr__role">{c.role}</span>}
                  {c.actorName && <span className="cr__actor">{c.actorName}</span>}
                </div>
                <input
                  className="cr__hebrew rtl"
                  dir="rtl"
                  placeholder="Hebrew name (optional)"
                  value={c.hebrew}
                  onChange={(e) => updateCharacter(c.original, { hebrew: e.target.value })}
                />
                <select
                  className={`cr__gender ${c.gender === 'unknown' ? 'is-unset' : ''}`}
                  value={c.gender}
                  onChange={(e) => updateCharacter(c.original, { gender: e.target.value as Gender })}
                >
                  {c.gender === 'unknown' && <option value="unknown">Select…</option>}
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className={`cr__badge cr__badge--${c.confidence}`}>{c.confidence}</span>
                <button
                  className="cr__remove"
                  title="Remove"
                  onClick={() => removeCharacter(c.original)}
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="cr__add">
              <input
                placeholder="Add a character name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitCharacter()}
              />
              <Button onClick={submitCharacter}>Add</Button>
            </div>
          </div>

          <div className="cr__terms">
            <h3>Fixed terms</h3>
            <p className="cr__sub">Force a consistent Hebrew translation for specific terms.</p>
            {Object.entries(review.terms).map(([from, to]) => (
              <div key={from} className="cr__term-row">
                <span className="cr__term-from">{from}</span>
                <span className="cr__term-arrow">→</span>
                <span className="cr__term-to rtl">{to}</span>
                <button className="cr__remove" onClick={() => removeTerm(from)}>
                  ✕
                </button>
              </div>
            ))}
            <div className="cr__term-add">
              <input
                placeholder="Term"
                value={termFrom}
                onChange={(e) => setTermFrom(e.target.value)}
              />
              <input
                className="rtl"
                dir="rtl"
                placeholder="עברית"
                value={termTo}
                onChange={(e) => setTermTo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitTerm()}
              />
              <Button onClick={submitTerm}>Add</Button>
            </div>
          </div>
        </div>

        <footer className="cr__foot">
          <Button variant="subtle" onClick={cancelReview}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canConfirm} onClick={confirmReview}>
            Confirm &amp; build glossary
          </Button>
        </footer>
      </div>
    </div>
  )
}
