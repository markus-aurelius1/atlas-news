/**
 * Whether the screen a component belongs to is the one on the stage.
 *
 * The Atlas is kept mounted behind the other workspaces (App.tsx) so that
 * returning to it is immediate. While it is behind, it must do nothing: no
 * window listeners, no animation frames, no deep-link handling. Its effects read
 * this and stand down. Every other screen is simply unmounted when left, so for
 * them the value is always true.
 */
import { createContext, useContext } from 'react'

export const ScreenActive = createContext(true)
export const useScreenActive = () => useContext(ScreenActive)
