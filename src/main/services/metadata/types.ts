import type { ContentDetection, ContentType, MetadataResult, MetadataSource } from '@shared/types'

/**
 * A pluggable source of character metadata. Each provider normalises its
 * upstream API into a common MetadataResult so the manager can route and
 * fall back between them interchangeably.
 */
export interface MetadataProvider {
  readonly source: MetadataSource
  /** Whether this provider is a good fit for the given content type. */
  supports(contentType: ContentType): boolean
  /** Whether the provider can run right now (e.g. has a required API key). */
  isAvailable(): boolean
  /** Look up characters for a title; resolve null when nothing is found. */
  search(detection: ContentDetection): Promise<MetadataResult | null>
}
