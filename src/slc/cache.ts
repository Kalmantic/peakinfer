/**
 * Cache Manager for PeakInfer
 *
 * Enables offline viewing of previous analysis results.
 *
 * Mental Model:
 * 1. After successful analyze, write results to .peakinfer/cache.json
 * 2. On --cached flag, read and render cached results
 * 3. Show clear timestamps so users know data freshness
 *
 * Design Principles (Julie Zhou / SLC):
 * - Respects user's time by enabling offline access
 * - Clear feedback about data freshness
 * - Graceful handling when cache doesn't exist
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StackMap, PricingSummary, TechStack, InferencePatterns } from './types.js';

const CACHE_DIR = '.peakinfer';
const CACHE_FILE = 'cache.json';

/**
 * Structure of cached analysis data
 */
export interface CachedAnalysis {
  // Metadata
  timestamp: string;
  version: string;
  targetPath: string;

  // Analysis results
  callsites: Array<{
    id: string;
    file: string;
    line: number;
    provider: string;
    model: string;
    taskKind?: string;
    isStreaming?: boolean;
    confidence: number;
  }>;
  stackMap: StackMap;
  pricing: PricingSummary;
  techStack?: TechStack;
  patterns?: InferencePatterns;

  // Scan info
  scan?: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };
}

/**
 * Write analysis results to cache.
 * Creates .peakinfer directory if it doesn't exist.
 */
export function writeCacheSync(
  targetPath: string,
  data: Omit<CachedAnalysis, 'timestamp' | 'version'>
): void {
  const cacheDir = path.join(targetPath, CACHE_DIR);

  // Create cache directory if needed
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const cached: CachedAnalysis = {
    ...data,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };

  const cachePath = path.join(cacheDir, CACHE_FILE);
  fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2), 'utf-8');
}

/**
 * Read cached analysis results.
 * Returns null if cache doesn't exist or is invalid.
 */
export function readCacheSync(targetPath: string): CachedAnalysis | null {
  const cachePath = path.join(targetPath, CACHE_DIR, CACHE_FILE);

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Basic validation
    if (!parsed.timestamp || !parsed.callsites || !parsed.stackMap) {
      return null;
    }

    return parsed as CachedAnalysis;
  } catch {
    return null;
  }
}

/**
 * Get human-readable cache age.
 * Example: "2 hours ago", "3 days ago", "just now"
 */
export function getCacheAge(cached: CachedAnalysis): string {
  const age = Date.now() - new Date(cached.timestamp).getTime();

  const minutes = Math.floor(age / (1000 * 60));
  const hours = Math.floor(age / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Format timestamp for display.
 * Example: "Dec 10, 2025 at 2:30 PM"
 */
export function formatCacheTimestamp(cached: CachedAnalysis): string {
  const date = new Date(cached.timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Check if cache exists for a given path.
 */
export function cacheExists(targetPath: string): boolean {
  const cachePath = path.join(targetPath, CACHE_DIR, CACHE_FILE);
  return fs.existsSync(cachePath);
}

/**
 * Delete cache for a given path.
 */
export function clearCache(targetPath: string): boolean {
  const cachePath = path.join(targetPath, CACHE_DIR, CACHE_FILE);

  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    return true;
  }

  return false;
}
