// [capabilities] — declarative platform capability flags.
// Subsystem guards read these instead of raw process.platform. When a darwin
// implementation for a subsystem lands later, flip the flag here — no repo-wide
// hunt for scattered platform checks.

import { isWin } from './platform'

export const capabilities = {
  /** Desktop agent (open/close/focus apps) — Windows PowerShell executor only. */
  desktopAgent: isWin,
  /** Windows-only perception: SMTC media session, Focus Assist, foreground window. */
  perception: isWin,
  /** Custom Go-launcher + robocopy/7za in-app updater — Windows only. */
  updater: isWin,
  /** Windows release niceties: .lnk desktop shortcut, uninstall.bat, NSIS. */
  releaseShortcuts: isWin
} as const

export type Capabilities = typeof capabilities

/** Shorthand for the common guard: "is this subsystem available on the current OS?" */
export function has(cap: keyof Capabilities): boolean {
  return Boolean(capabilities[cap])
}
