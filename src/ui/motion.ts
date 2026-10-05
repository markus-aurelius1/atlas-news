/**
 * The motion system. Every animation in the app picks from these, so timing
 * and feel stay consistent. The CSS twins live in index.css (--ease-*, --dur-*).
 *
 *   instant   90 ms   press in
 *   fast     140 ms   hover, small reveals, exits
 *   base     220 ms   popovers, content swaps, list items
 *   slow     320 ms   panels, sheets, layout moves
 *   calm     520 ms   a calm change of mode
 *
 * Use a *role* from `M` (below) rather than a duration: a role says what the
 * movement is for, and under reduced motion each role already has its quieter
 * form. Springs are for things the user moves or that track a changing target;
 * durations are for things that simply appear or leave. Only transform and
 * opacity animate. Exits are about 60% of the matching enter.
 *
 * Reduced motion (lib/motion.ts): movement becomes a cross-fade, progress still
 * moves, loops are off. <MotionConfig> in App.tsx reads the same preference.
 */
import type { Transition } from 'motion/react'

/** Standard deceleration – things arriving. */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const
/** Symmetric – things moving from one place to another. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const
/** Acceleration – things leaving. */
export const EASE_IN = [0.4, 0, 1, 1] as const

export const DUR = {
  instant: 0.09,
  fast: 0.14,
  base: 0.22,
  slow: 0.32,
  /** A calm change of mode – slow enough to read as a change of mode. */
  calm: 0.52,
  /** Earlier names for fast and slow. */
  micro: 0.14,
  layout: 0.32,
} as const

/** The four springs. No bounce: each is at or near critical damping. */
export const SPRING = {
  /** Press release, switch thumb, checkbox. */
  snap: { type: 'spring', stiffness: 700, damping: 45 },
  /** Selection indicators (the active tab, the rail item, a segmented control). */
  glide: { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 },
  /** Sheets and panels; takes over the velocity of the drag that released them. */
  surface: { type: 'spring', stiffness: 420, damping: 40 },
  /** List items and toasts finding their place. */
  settle: { type: 'spring', stiffness: 380, damping: 34 },
} satisfies Record<string, Transition>

export const T = {
  instant: { duration: DUR.instant, ease: EASE_OUT },
  fast: { duration: DUR.fast, ease: EASE_OUT },
  micro: { duration: DUR.fast, ease: EASE_OUT },
  base: { duration: DUR.base, ease: EASE_OUT },
  exit: { duration: DUR.fast, ease: EASE_IN },
  slow: { duration: DUR.slow, ease: EASE_OUT },
  layout: { duration: DUR.slow, ease: EASE_IN_OUT },
  calm: { duration: DUR.calm, ease: EASE_IN_OUT },
  /** Snappy spring for indicators (active tab pill, toggles). */
  indicator: SPRING.glide,
  /** Bottom sheets and larger surfaces. */
  sheet: SPRING.surface,
  /** Gentle spring for list items settling. */
  item: SPRING.settle,
  /** A control answering a press: quick, critically damped – no bounce. */
  press: SPRING.snap,
} satisfies Record<string, Transition>

/** A screen arriving: the old one leaves at once, the new one rises a few pixels into place. */
export const screenEnter = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
}

/** Fade + small rise, the default way content appears. */
export const rise = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: T.base },
  exit: { opacity: 0, y: -4, transition: T.exit },
}

/** A list row entering / leaving (used with AnimatePresence + layout). */
export const listItem = {
  initial: { opacity: 0, y: 6, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: T.item },
  exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, transition: { duration: DUR.fast, ease: EASE_IN } },
}

/** Popovers / menus growing out of their anchor. */
export const pop = {
  initial: { opacity: 0, y: -4, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: T.fast },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: T.exit },
}

/**
 * Motion roles. Spread one onto a motion element:
 *
 *   <motion.div {...M.reveal} />                 a popover, a menu, an inline expansion
 *   <motion.div key={step} {...M.swap} />        sibling views, a sheet's content, quiz questions
 *   <motion.div {...M.push} />                   drilling in; M.pop for coming back
 *   <motion.li layout {...M.listItem} />         rows entering, leaving and reordering
 *
 * and use the transitions for things that have no enter/exit of their own:
 * M.indicator (shared-layout pill), M.surface (a sheet or panel following a
 * drag), M.press (a control answering a press), M.progress (a bar taking a step).
 */
export const M = {
  /** Opacity and a 4 px rise; leaves faster than it came. */
  reveal: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0, transition: T.base },
    exit: { opacity: 0, y: 2, transition: T.exit },
  },
  /** A cross-fade in place, no movement. */
  swap: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: T.base },
    exit: { opacity: 0, transition: T.exit },
  },
  /** Drill in: the new view slides 24 px and fades in. */
  push: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0, transition: T.slow },
    exit: { opacity: 0, x: -8, transition: T.exit },
  },
  /** Return: the mirror of push. */
  pop: {
    initial: { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0, transition: T.slow },
    exit: { opacity: 0, x: 8, transition: T.exit },
  },
  /** A dialog arriving in the middle of the screen. */
  dialog: {
    initial: { opacity: 0, scale: 0.97, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0, transition: T.base },
    exit: { opacity: 0, scale: 0.985, y: 4, transition: T.exit },
  },
  /** The dimmed backdrop behind a modal surface. */
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: T.base },
    exit: { opacity: 0, transition: T.exit },
  },
  listItem,
  /** A one-shot confirmation: a small swell that settles. */
  success: {
    initial: { scale: 0.6, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: SPRING.snap },
  },
  indicator: SPRING.glide,
  surface: SPRING.surface,
  settle: SPRING.settle,
  press: SPRING.snap,
  /** A bar or ring taking a step (continuous progress uses a compositor animation). */
  progress: T.base,
} as const

/** How many items a list staggers at most, and by how much (never on a return navigation). */
export const STAGGER = { max: 5, each: 0.03 } as const
