/**
 * AnswerTile: one choice in a question. Every question surface in the app uses
 * this tile, so "selected", "right" and "wrong" look and feel the same in a
 * recall review, a past-paper question and a map question.
 *
 * It is a small physical card: it lifts a little on hover, sinks under a press,
 * takes an accent edge when chosen, and after the answer is saved shows right
 * or wrong with a colour, a mark and a word for assistive technology – never by
 * colour alone. Once locked it stops answering presses but stays readable.
 */
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Pressable } from '../../Pressable'

export type AnswerState = 'idle' | 'correct' | 'incorrect'

export interface AnswerTileProps {
  /** A, B, C… (or 1, 2, 3…): shown on the tile and matched to the keyboard. */
  letter: string
  children: ReactNode
  /** The learner's choice. */
  selected?: boolean
  /** After the answer is saved: is this option the right one, or the wrong one they chose? */
  state?: AnswerState
  /** Locked: the attempt has been saved. */
  disabled?: boolean
  onSelect: () => void
  /** `radio` for one answer, `checkbox` when several can be chosen. */
  role?: 'radio' | 'checkbox'
  className?: string
}

export function AnswerTile({ letter, children, selected, state = 'idle', disabled, onSelect, role = 'radio', className }: AnswerTileProps) {
  const verdict = state === 'correct' ? 'Correct answer' : state === 'incorrect' ? 'Incorrect' : null
  return (
    <Pressable
      role={role}
      aria-checked={!!selected}
      // Locked tiles stay in the reading order; they just no longer respond.
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      press={disabled ? 'none' : 'surface'}
      haptic={disabled ? 'none' : 'tap'}
      plain
      data-state={state}
      data-selected={selected ? '' : undefined}
      data-locked={disabled ? '' : undefined}
      data-answer={letter}
      className={cn('answer', className)}
      onClick={() => {
        if (!disabled) onSelect()
      }}
    >
      <span className="answer-key" aria-hidden="true">
        {state === 'correct' ? <Check className="size-4" strokeWidth={3} /> : state === 'incorrect' ? <X className="size-4" strokeWidth={3} /> : letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{letter}. </span>
        {children}
        {verdict && <span className="sr-only"> – {verdict}</span>}
      </span>
    </Pressable>
  )
}
