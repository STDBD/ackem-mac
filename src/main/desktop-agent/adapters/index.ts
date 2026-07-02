// [platform-dispatch barrel] — routes desktop-agent execution to the
// platform-native adapter. On non-Windows we short-circuit with an
// "unsupported" result so PowerShell-specific code is never loaded at
// runtime (the win/executor module is only dynamically imported on win).
import { isWin } from '../../platform/platform'
import type { DesktopAgentAction, UseComputerArgs } from '../../../shared/desktopAgent'
import type { ExecuteResult } from './win/executor'

// re-export the executor's types so callers stay typed
export type { ExecuteResult } from './win/executor'

export async function executeDesktopAgentAction(
  action: DesktopAgentAction,
  args: UseComputerArgs,
  ctx: { dataRoot: string; downloadDir?: string; cwd: string }
): Promise<ExecuteResult> {
  if (!isWin) {
    return {
      ok: false,
      content: '当前系统不支持电脑助手操作',
      summary: '当前系统不支持电脑助手操作'
    }
  }
  const { executeDesktopAgentAction: impl } = await import('./win/executor')
  return impl(action, args, ctx)
}
