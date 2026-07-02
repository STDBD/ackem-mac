// [platform] — single source of truth for OS detection.
// All platform branching in the app should import from here, not read
// process.platform directly (keeps the port surface in one place).

export type Platform = 'darwin' | 'win32' | 'linux'

export const platform: Platform = process.platform as Platform

export const isMac = platform === 'darwin'
export const isWin = platform === 'win32'
export const isLinux = platform === 'linux'

/** Apple Silicon vs Intel — only meaningful when isMac. */
export const isArm64 = process.arch === 'arm64'
