/**
 * Context Manager - PeakInfer TDD v1.3 (Autonomous Agent Architecture)
 * 
 * Filesystem-based context management for:
 * - Saving tool outputs to disk
 * - On-demand context loading
 * - Resumability after crashes
 * - Persistent debugging
 * 
 * Directory Structure:
 * .peakinfer/
 *   runs/
 *     <run-id>/
 *       state.json          # Execution state
 *       plan.json           # Execution plan
 *       <task-id>.json      # Task results
 *   history/
 *     <timestamp>.json      # Conversation history snapshots
 *   cache/
 *     <hash>.json           # Cached tool results
 *   config/
 *     defaults.json         # User preferences
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { ExecutionPlan, ExecutionState, ResolvedTask } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context pointer - reference to stored data without loading it.
 */
export interface ContextPointer {
  /** Unique identifier */
  id: string;
  
  /** Type of context */
  type: 'task_result' | 'tool_output' | 'history' | 'cache';
  
  /** Path to the stored file */
  path: string;
  
  /** Size in bytes */
  sizeBytes: number;
  
  /** Brief summary (to help decide if worth loading) */
  summary: string;
  
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Run metadata.
 */
export interface RunMetadata {
  /** Run identifier */
  runId: string;
  
  /** Query that initiated this run */
  query: string;
  
  /** Analysis mode */
  mode: 'static' | 'runtime' | 'combined';
  
  /** Target path */
  target: string;
  
  /** Start time */
  startedAt: string;
  
  /** End time (if completed) */
  completedAt?: string;
  
  /** Current status */
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'paused';
  
  /** Total API cost */
  totalCostUsd: number;
  
  /** Context pointers for task results */
  contextPointers: ContextPointer[];
}

/**
 * Context manager configuration.
 */
export interface ContextManagerConfig {
  /** Base directory for context storage */
  baseDir: string;
  
  /** Maximum age for cache entries (ms) */
  cacheTtlMs: number;
  
  /** Maximum runs to keep */
  maxRuns: number;
  
  /** Maximum history entries to keep */
  maxHistory: number;
  
  /** Enable compression for large files */
  compressLargeFiles: boolean;
  
  /** Size threshold for compression (bytes) */
  compressionThreshold: number;
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  baseDir: '.peakinfer',
  cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRuns: 50,
  maxHistory: 100,
  compressLargeFiles: false,
  compressionThreshold: 1024 * 1024, // 1MB
};

// =============================================================================
// CONTEXT MANAGER
// =============================================================================

export class ContextManager {
  private config: ContextManagerConfig;
  private cwd: string;
  
  constructor(cwd: string, config: Partial<ContextManagerConfig> = {}) {
    this.cwd = cwd;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureDirectories();
  }
  
  // ===========================================================================
  // DIRECTORY MANAGEMENT
  // ===========================================================================
  
  /**
   * Ensure all required directories exist.
   */
  private ensureDirectories(): void {
    const dirs = [
      this.getPath('runs'),
      this.getPath('history'),
      this.getPath('cache'),
      this.getPath('config'),
    ];
    
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  /**
   * Get full path for a context type.
   */
  private getPath(...parts: string[]): string {
    return path.join(this.cwd, this.config.baseDir, ...parts);
  }
  
  /**
   * Get run directory path.
   */
  getRunPath(runId: string): string {
    return this.getPath('runs', runId);
  }
  
  // ===========================================================================
  // RUN MANAGEMENT
  // ===========================================================================
  
  /**
   * Create a new run.
   */
  createRun(
    runId: string,
    query: string,
    mode: 'static' | 'runtime' | 'combined',
    target: string
  ): RunMetadata {
    const runDir = this.getRunPath(runId);
    fs.mkdirSync(runDir, { recursive: true });
    
    const metadata: RunMetadata = {
      runId,
      query,
      mode,
      target,
      startedAt: new Date().toISOString(),
      status: 'planning',
      totalCostUsd: 0,
      contextPointers: [],
    };
    
    this.saveRunMetadata(runId, metadata);
    
    // Cleanup old runs if needed
    this.cleanupOldRuns();
    
    return metadata;
  }
  
  /**
   * Get run metadata.
   */
  getRunMetadata(runId: string): RunMetadata | null {
    const metaPath = path.join(this.getRunPath(runId), 'metadata.json');
    
    try {
      const data = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  /**
   * Update run metadata.
   */
  saveRunMetadata(runId: string, metadata: RunMetadata): void {
    const metaPath = path.join(this.getRunPath(runId), 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  }
  
  /**
   * List all runs.
   */
  listRuns(): RunMetadata[] {
    const runsDir = this.getPath('runs');
    const runs: RunMetadata[] = [];
    
    try {
      const entries = fs.readdirSync(runsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadata = this.getRunMetadata(entry.name);
          if (metadata) {
            runs.push(metadata);
          }
        }
      }
    } catch {
      // Directory may not exist
    }
    
    return runs.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }
  
  /**
   * Get latest incomplete run (for resuming).
   */
  getLatestIncompleteRun(): RunMetadata | null {
    const runs = this.listRuns();
    return runs.find(r => r.status === 'executing' || r.status === 'paused') || null;
  }
  
  /**
   * Cleanup old runs.
   */
  private cleanupOldRuns(): void {
    const runs = this.listRuns();
    
    if (runs.length > this.config.maxRuns) {
      const toDelete = runs.slice(this.config.maxRuns);
      
      for (const run of toDelete) {
        try {
          fs.rmSync(this.getRunPath(run.runId), { recursive: true, force: true });
        } catch {
          // Ignore deletion errors
        }
      }
    }
  }
  
  // ===========================================================================
  // EXECUTION STATE
  // ===========================================================================
  
  /**
   * Save execution plan.
   */
  savePlan(runId: string, plan: ExecutionPlan): void {
    const planPath = path.join(this.getRunPath(runId), 'plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  }
  
  /**
   * Load execution plan.
   */
  loadPlan(runId: string): ExecutionPlan | null {
    const planPath = path.join(this.getRunPath(runId), 'plan.json');
    
    try {
      const data = fs.readFileSync(planPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  /**
   * Save execution state.
   */
  saveState(runId: string, state: ExecutionState): void {
    const statePath = path.join(this.getRunPath(runId), 'state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }
  
  /**
   * Load execution state.
   */
  loadState(runId: string): ExecutionState | null {
    const statePath = path.join(this.getRunPath(runId), 'state.json');
    
    try {
      const data = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  // ===========================================================================
  // TASK RESULTS
  // ===========================================================================
  
  /**
   * Save task result and return context pointer.
   */
  saveTaskResult(
    runId: string,
    taskId: string,
    result: unknown
  ): ContextPointer {
    const resultPath = path.join(this.getRunPath(runId), `${taskId}.json`);
    const content = JSON.stringify(result, null, 2);
    
    fs.writeFileSync(resultPath, content);
    
    const pointer: ContextPointer = {
      id: taskId,
      type: 'task_result',
      path: resultPath,
      sizeBytes: Buffer.byteLength(content),
      summary: this.generateSummary(result),
      createdAt: new Date().toISOString(),
    };
    
    // Update run metadata with new pointer
    const metadata = this.getRunMetadata(runId);
    if (metadata) {
      metadata.contextPointers.push(pointer);
      this.saveRunMetadata(runId, metadata);
    }
    
    return pointer;
  }
  
  /**
   * Load task result by pointer.
   */
  loadTaskResult(pointer: ContextPointer): unknown {
    try {
      const data = fs.readFileSync(pointer.path, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  /**
   * Load task result by ID.
   */
  loadTaskResultById(runId: string, taskId: string): unknown {
    const resultPath = path.join(this.getRunPath(runId), `${taskId}.json`);
    
    try {
      const data = fs.readFileSync(resultPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  // ===========================================================================
  // CACHE
  // ===========================================================================
  
  /**
   * Generate cache key for tool invocation.
   */
  private getCacheKey(toolName: string, args: Record<string, unknown>): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify({ tool: toolName, args }));
    return hash.digest('hex').slice(0, 16);
  }
  
  /**
   * Check if cached result exists and is valid.
   */
  getCachedResult(toolName: string, args: Record<string, unknown>): unknown | null {
    const key = this.getCacheKey(toolName, args);
    const cachePath = this.getPath('cache', `${key}.json`);
    
    try {
      const stat = fs.statSync(cachePath);
      const age = Date.now() - stat.mtimeMs;
      
      if (age > this.config.cacheTtlMs) {
        // Cache expired
        fs.unlinkSync(cachePath);
        return null;
      }
      
      const data = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  /**
   * Cache a tool result.
   */
  cacheResult(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown
  ): void {
    const key = this.getCacheKey(toolName, args);
    const cachePath = this.getPath('cache', `${key}.json`);
    
    const cacheEntry = {
      tool: toolName,
      args,
      result,
      cachedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheEntry, null, 2));
  }
  
  /**
   * Clear expired cache entries.
   */
  clearExpiredCache(): number {
    const cacheDir = this.getPath('cache');
    let cleared = 0;
    
    try {
      const entries = fs.readdirSync(cacheDir);
      const now = Date.now();
      
      for (const entry of entries) {
        const entryPath = path.join(cacheDir, entry);
        
        try {
          const stat = fs.statSync(entryPath);
          const age = now - stat.mtimeMs;
          
          if (age > this.config.cacheTtlMs) {
            fs.unlinkSync(entryPath);
            cleared++;
          }
        } catch {
          // Ignore errors for individual files
        }
      }
    } catch {
      // Cache dir may not exist
    }
    
    return cleared;
  }
  
  // ===========================================================================
  // HISTORY
  // ===========================================================================
  
  /**
   * Save history snapshot.
   */
  saveHistory(messages: unknown[]): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const historyPath = this.getPath('history', `${timestamp}.json`);
    
    fs.writeFileSync(historyPath, JSON.stringify(messages, null, 2));
    
    // Cleanup old history
    this.cleanupOldHistory();
    
    return historyPath;
  }
  
  /**
   * Load latest history.
   */
  loadLatestHistory(): unknown[] | null {
    const historyDir = this.getPath('history');
    
    try {
      const entries = fs.readdirSync(historyDir)
        .filter(e => e.endsWith('.json'))
        .sort()
        .reverse();
      
      if (entries.length === 0) return null;
      
      const latestPath = path.join(historyDir, entries[0]);
      const data = fs.readFileSync(latestPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  /**
   * Cleanup old history entries.
   */
  private cleanupOldHistory(): void {
    const historyDir = this.getPath('history');
    
    try {
      const entries = fs.readdirSync(historyDir)
        .filter(e => e.endsWith('.json'))
        .sort()
        .reverse();
      
      if (entries.length > this.config.maxHistory) {
        const toDelete = entries.slice(this.config.maxHistory);
        
        for (const entry of toDelete) {
          try {
            fs.unlinkSync(path.join(historyDir, entry));
          } catch {
            // Ignore
          }
        }
      }
    } catch {
      // Ignore
    }
  }
  
  // ===========================================================================
  // CONFIG
  // ===========================================================================
  
  /**
   * Load user configuration.
   */
  loadUserConfig(): Record<string, unknown> {
    const configPath = this.getPath('config', 'defaults.json');
    
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  
  /**
   * Save user configuration.
   */
  saveUserConfig(config: Record<string, unknown>): void {
    const configPath = this.getPath('config', 'defaults.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  
  // ===========================================================================
  // UTILITIES
  // ===========================================================================
  
  /**
   * Generate a brief summary of result for context pointer.
   */
  private generateSummary(result: unknown): string {
    if (result === null || result === undefined) {
      return 'null result';
    }
    
    if (typeof result === 'string') {
      return `string (${result.length} chars)`;
    }
    
    if (Array.isArray(result)) {
      return `array of ${result.length} items`;
    }
    
    if (typeof result === 'object') {
      const keys = Object.keys(result);
      return `object with ${keys.length} keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
    }
    
    return String(result).slice(0, 50);
  }
  
  /**
   * Get storage statistics.
   */
  getStats(): {
    totalRuns: number;
    totalCacheEntries: number;
    totalHistoryEntries: number;
    totalSizeBytes: number;
  } {
    let totalSizeBytes = 0;
    
    const countDir = (dir: string): number => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        let count = 0;
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isFile()) {
            count++;
            try {
              totalSizeBytes += fs.statSync(fullPath).size;
            } catch {
              // Ignore
            }
          } else if (entry.isDirectory()) {
            count += countDir(fullPath);
          }
        }
        
        return count;
      } catch {
        return 0;
      }
    };
    
    return {
      totalRuns: this.listRuns().length,
      totalCacheEntries: countDir(this.getPath('cache')),
      totalHistoryEntries: countDir(this.getPath('history')),
      totalSizeBytes,
    };
  }
  
  /**
   * Clear all context data.
   */
  clearAll(): void {
    try {
      fs.rmSync(path.join(this.cwd, this.config.baseDir), { recursive: true, force: true });
      this.ensureDirectories();
    } catch {
      // Ignore errors
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { DEFAULT_CONFIG as DEFAULT_CONTEXT_CONFIG };

