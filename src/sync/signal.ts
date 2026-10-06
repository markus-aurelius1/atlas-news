/** Window events that tie sync to the rest of the app without either importing the other's internals. */
/** Something the app stores outside the database changed in this tab (News reading state). */
export const LOCAL_CHANGE_EVENT = 'tars:local-change'
/** Sync rewrote the News reading state; open views read it again. */
export const PERSONAL_STATE_EVENT = 'tars:personal-state'
/** The set of pinned Saved articles changed. */
export const PINNED_EVENT = 'tars:pinned-articles'
/** The count of articles opened at smry.ai changed (re-exported name: current-affairs/reader/elsewhere.ts). */
export const READER_EVENT = 'tars:reader-smry'
/** Existing event: the short notes changed underneath their views. */
export const NOTES_EVENT = 'tars:notes-changed'

export function noteLocalChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT))
}
