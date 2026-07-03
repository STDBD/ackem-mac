/**
 * Pre-LLM Embedding 预热与模块级缓存（锚点 / 时间语义 / profile / createTool）
 */

import type { EmbeddingProvider } from '../memory/embedding'
import {
  buildAnchorVectors,
  buildProfileAnchors,
  buildCreateToolAnchor,
} from './anchorVectors'
import { buildTemporalEmbeddings } from '../memory/temporalSignalExtractor'
import type { AnchorVectors, ProfileAnchors } from './types'

let cachedAnchorVectors: AnchorVectors | null = null
let cachedProfileAnchors: ProfileAnchors | null = null
let cachedCreateToolAnchor: number[] | null = null
let cachedTemporalEmbeddings: Map<string, number[]> | null = null
let cachedProviderSig = ''

export function invalidatePreLlmEmbeddingCache(): void {
  cachedAnchorVectors = null
  cachedProfileAnchors = null
  cachedCreateToolAnchor = null
  cachedTemporalEmbeddings = null
  cachedProviderSig = ''
}

export async function getCachedAnchorVectors(
  provider: EmbeddingProvider
): Promise<AnchorVectors> {
  const sig = provider.name()
  if (cachedAnchorVectors && cachedProviderSig === sig) {
    return cachedAnchorVectors
  }
  cachedAnchorVectors = await buildAnchorVectors(provider)
  cachedProfileAnchors = await buildProfileAnchors(provider)
  cachedCreateToolAnchor = await buildCreateToolAnchor(provider)
  cachedProviderSig = sig
  return cachedAnchorVectors
}

export function getCachedProfileAnchors(): ProfileAnchors | null {
  return cachedProfileAnchors
}

export function getCachedCreateToolAnchor(): number[] | null {
  return cachedCreateToolAnchor
}

export async function getCachedTemporalEmbeddings(
  provider: EmbeddingProvider
): Promise<Map<string, number[]>> {
  const sig = provider.name()
  if (cachedTemporalEmbeddings && cachedProviderSig === sig) {
    return cachedTemporalEmbeddings
  }
  cachedTemporalEmbeddings = await buildTemporalEmbeddings(provider)
  if (cachedProviderSig === '') cachedProviderSig = sig
  return cachedTemporalEmbeddings
}

/** 启动时预热：锚点 + 时间锚点 embedding（幂等） */
export async function warmupPreLlmEmbeddings(
  provider: EmbeddingProvider,
  _dataRoot?: string
): Promise<void> {
  if (!provider.ready()) return
  const tasks: Array<Promise<unknown>> = [
    getCachedAnchorVectors(provider),
    getCachedTemporalEmbeddings(provider),
  ]
  await Promise.all(tasks)
}
