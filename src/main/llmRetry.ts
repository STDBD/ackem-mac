// [llmRetry] — LLM 请求韧性：超时、重试、速率限制处理
//
// 重试策略（用户指定）：
//   前 5 次：固定 3s 间隔
//   第 6 次起：指数退避（3 × 2^n），最高 30s
//   最多重试 20 次（共 21 次请求）

import { createLogger } from './logger'

const log = createLogger('llm-retry')

const MAX_RETRIES = 20
const FIXED_DELAY_MS = 3000          // 前 5 次固定间隔
const FIXED_RETRY_COUNT = 5          // 第 0–4 次为固定
const EXPONENTIAL_BASE_MS = 3000     // 指数退避基数（延续 3s）
const MAX_DELAY_MS = 30000           // 单次延迟上限

function isRetryable(status: number): boolean {
  // 429 Rate Limit, 5xx Server Error
  return status === 429 || (status >= 500 && status < 600)
}

function getRetryDelay(retryCount: number, retryAfterHeader?: string | null): number {
  // 优先使用服务器返回的 Retry-After
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10)
    if (!isNaN(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_DELAY_MS)
    }
  }
  // 前 5 次：固定 3s
  if (retryCount < FIXED_RETRY_COUNT) {
    return FIXED_DELAY_MS
  }
  // 第 6 次起：指数退避 3 × 2^n，封顶 30s，加 ±25% 抖动
  const expIndex = retryCount - FIXED_RETRY_COUNT + 1 // 1, 2, 3 …
  const base = Math.min(EXPONENTIAL_BASE_MS * Math.pow(2, expIndex), MAX_DELAY_MS)
  const jitter = base * 0.25 * (Math.random() * 2 - 1)
  return Math.min(base + jitter, MAX_DELAY_MS)
}

/**
 * 可被外部 AbortSignal 取消的延迟 sleep。
 * 如果外部 abort 在 sleep 期间触发，立即 reject（不等满延迟）。
 */
function abortableDelay(ms: number, externalSignal?: AbortSignal | null): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (externalSignal?.aborted) {
      reject(new DOMException('操作已取消', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('操作已取消', 'AbortError'))
    }
    externalSignal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number },
  retries = MAX_RETRIES
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 120_000
  const externalSignal = init.signal ?? null

  for (let attempt = 0; attempt <= retries; attempt++) {
    // 每次尝试前检查外部取消（避免在 sleep 后又发一个注定被 abort 的请求）
    if (externalSignal?.aborted) {
      throw new DOMException('操作已取消', 'AbortError')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onExternalAbort = (): void => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort)

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal
      })
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)

      if (res.ok) return res

      // 可重试的错误
      if (attempt < retries && isRetryable(res.status)) {
        const retryAfter = res.headers.get('Retry-After')
        const delay = getRetryDelay(attempt, retryAfter)
        log.warn(`LLM retryable error ${res.status}`, { attempt: attempt + 1, of: retries + 1, delayMs: Math.round(delay) })
        await abortableDelay(delay, externalSignal)
        continue
      }

      return res
    } catch (err) {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)

      if ((err as Error).name === 'AbortError') {
        // 外部取消（非超时）—— 不重试，直接抛
        if (externalSignal?.aborted) {
          throw new DOMException('操作已取消', 'AbortError')
        }
        // 自身超时 —— 重试
        if (attempt < retries) {
          const delay = getRetryDelay(attempt, null)
          log.warn('LLM request timeout, retrying', { attempt: attempt + 1, of: retries + 1, delayMs: Math.round(delay) })
          await abortableDelay(delay, externalSignal)
          continue
        }
        throw new Error(`LLM request timed out after ${timeoutMs}ms`)
      }

      // 网络错误重试
      if (attempt < retries) {
        const delay = getRetryDelay(attempt, null)
        log.warn('LLM network error, retrying', { attempt: attempt + 1, of: retries + 1, delayMs: Math.round(delay), error: (err as Error).message })
        await abortableDelay(delay, externalSignal)
        continue
      }

      throw err
    }
  }

  throw new Error('LLM request failed after max retries')
}
