/**
 * Context Manager - PeakInfer TDD v1.3 Section 6
 * 
 * Manages the .peakinfer/ directory structure for:
 * - Run persistence and resumability
 * - Artifact storage
 * - Caching (LLM responses, reference data)
 * - Logging
 * 
 * Directory Layout (TDD v1.3 Section 6.1):
 * .peakinfer/
 *   runs/
 *     <runId>/
 *       plan.json       - Execution plan
 *       scan.json       - Scan results
 *       static.json     - Static analysis results
 *       runtime.json    - Runtime analysis results
 *       joined.json     - Joined analysis results
 *       tradeoffs.json  - Trade-off analysis
 *       stackmap.json   - InferenceMap
 *       report.html     - HTML report
 *       meta.json       - Run metadata
 *   cache/
 *     llm/              - LLM response cache
 *     refs/             - Reference data cache
 *   logs/
 *     <runId>.log       - Run logs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface RunMetadata {
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  repoRoot: string;
  eventsFile?: string;
  mode: 'static' | 'runtime' | 'combined';
  toolVersions: {
    peakinfer: string;
    node: string;
  };
  inputsHash: string;
  refsVersion?: string;
}

export interface RunArtifacts {
  plan?: object;
  scan?: object;
  static?: object;
  runtime?: object;
  joined?: object;
  tradeoffs?: object;
  stackmap?: object;
  pricing?: object;
}

export interface CacheEntry {
  key: string;
  value: unknown;
  createdAt: string;
  expiresAt?: string;
  hits: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PEAKINFER_DIR = '.peakinfer';
const RUNS_DIR = 'runs';
const CACHE_DIR = 'cache';
const LOGS_DIR = 'logs';
const LLM_CACHE_DIR = 'llm';
const REFS_CACHE_DIR = 'refs';

const PEAKINFER_VERSION = '1.3.0';

// =============================================================================
// CONTEXT MANAGER CLASS
// =============================================================================

export class ContextManager {
  private baseDir: string;
  private currentRunId: string | null = null;
  
  constructor(repoRoot: string) {
    this.baseDir = path.join(repoRoot, PEAKINFER_DIR);
  }
  
  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  
  /**
   * Initialize the .peakinfer directory structure.
   */
  async initialize(): Promise<void> {
    // Create directory structure
    await this.ensureDir(this.baseDir);
    await this.ensureDir(path.join(this.baseDir, RUNS_DIR));
    await this.ensureDir(path.join(this.baseDir, CACHE_DIR));
    await this.ensureDir(path.join(this.baseDir, CACHE_DIR, LLM_CACHE_DIR));
    await this.ensureDir(path.join(this.baseDir, CACHE_DIR, REFS_CACHE_DIR));
    await this.ensureDir(path.join(this.baseDir, LOGS_DIR));
  }
  
  // ===========================================================================
  // RUN MANAGEMENT
  // ===========================================================================
  
  /**
   * Start a new analysis run.
   * Creates run directory and initializes metadata.
   */
  async startRun(
    repoRoot: string,
    mode: 'static' | 'runtime' | 'combined',
    eventsFile?: string,
    refsVersion?: string
  ): Promise<string> {
    // Generate run ID based on inputs (TDD v1.3 Section 6.3)
    const inputsHash = this.computeInputsHash(repoRoot, eventsFile, refsVersion);
    const runId = `run_${Date.now()}_${inputsHash.substring(0, 8)}`;
    
    // Create run directory
    const runDir = path.join(this.baseDir, RUNS_DIR, runId);
    await this.ensureDir(runDir);
    
    // Initialize metadata
    const metadata: RunMetadata = {
      runId,
      startedAt: new Date().toISOString(),
      status: 'running',
      repoRoot,
      eventsFile,
      mode,
      toolVersions: {
        peakinfer: PEAKINFER_VERSION,
        node: process.version,
      },
      inputsHash,
      refsVersion,
    };
    
    await this.writeArtifact(runId, 'meta', metadata);
    
    // Initialize log file
    const logPath = path.join(this.baseDir, LOGS_DIR, `${runId}.log`);
    fs.writeFileSync(logPath, `[${new Date().toISOString()}] Run started: ${runId}\n`);
    
    this.currentRunId = runId;
    return runId;
  }
  
  /**
   * Complete a run.
   */
  async completeRun(runId: string, status: 'completed' | 'failed' | 'partial' = 'completed'): Promise<void> {
    const metadata = await this.getRunMetadata(runId);
    if (metadata) {
      metadata.completedAt = new Date().toISOString();
      metadata.status = status;
      await this.writeArtifact(runId, 'meta', metadata);
    }
    
    this.log(runId, `Run ${status}: ${runId}`);
  }
  
  /**
   * Get run metadata.
   */
  async getRunMetadata(runId: string): Promise<RunMetadata | null> {
    return this.readArtifact(runId, 'meta') as Promise<RunMetadata | null>;
  }
  
  /**
   * List all runs.
   */
  async listRuns(): Promise<RunMetadata[]> {
    const runsDir = path.join(this.baseDir, RUNS_DIR);
    if (!fs.existsSync(runsDir)) return [];
    
    const entries = fs.readdirSync(runsDir, { withFileTypes: true });
    const runs: RunMetadata[] = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('run_')) {
        const metadata = await this.getRunMetadata(entry.name);
        if (metadata) runs.push(metadata);
      }
    }
    
    // Sort by startedAt descending
    return runs.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }
  
  /**
   * Find a compatible cached run (TDD v1.3 Section 6.2).
   */
  async findCachedRun(
    repoRoot: string,
    eventsFile?: string,
    refsVersion?: string
  ): Promise<string | null> {
    const inputsHash = this.computeInputsHash(repoRoot, eventsFile, refsVersion);
    
    const runs = await this.listRuns();
    for (const run of runs) {
      if (
        run.status === 'completed' &&
        run.inputsHash === inputsHash &&
        run.refsVersion === refsVersion
      ) {
        return run.runId;
      }
    }
    
    return null;
  }
  
  // ===========================================================================
  // ARTIFACT MANAGEMENT
  // ===========================================================================
  
  /**
   * Write an artifact to a run.
   */
  async writeArtifact(runId: string, name: string, data: unknown): Promise<string> {
    const artifactPath = this.getArtifactPath(runId, name);
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(artifactPath, content, 'utf-8');
    this.log(runId, `Artifact written: ${name}.json`);
    return artifactPath;
  }
  
  /**
   * Read an artifact from a run.
   */
  async readArtifact(runId: string, name: string): Promise<unknown | null> {
    const artifactPath = this.getArtifactPath(runId, name);
    if (!fs.existsSync(artifactPath)) return null;
    
    try {
      const content = fs.readFileSync(artifactPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  /**
   * Check if an artifact exists.
   */
  hasArtifact(runId: string, name: string): boolean {
    return fs.existsSync(this.getArtifactPath(runId, name));
  }
  
  /**
   * Get all artifacts for a run.
   */
  async getRunArtifacts(runId: string): Promise<RunArtifacts> {
    return {
      plan: await this.readArtifact(runId, 'plan') as object | undefined,
      scan: await this.readArtifact(runId, 'scan') as object | undefined,
      static: await this.readArtifact(runId, 'static') as object | undefined,
      runtime: await this.readArtifact(runId, 'runtime') as object | undefined,
      joined: await this.readArtifact(runId, 'joined') as object | undefined,
      tradeoffs: await this.readArtifact(runId, 'tradeoffs') as object | undefined,
      stackmap: await this.readArtifact(runId, 'stackmap') as object | undefined,
      pricing: await this.readArtifact(runId, 'pricing') as object | undefined,
    };
  }
  
  /**
   * Get path to artifact.
   */
  getArtifactPath(runId: string, name: string): string {
    return path.join(this.baseDir, RUNS_DIR, runId, `${name}.json`);
  }
  
  /**
   * Get path to run directory.
   */
  getRunDir(runId: string): string {
    return path.join(this.baseDir, RUNS_DIR, runId);
  }
  
  // ===========================================================================
  // CACHING
  // ===========================================================================
  
  /**
   * Get cached LLM response.
   */
  async getLLMCache(promptHash: string): Promise<unknown | null> {
    const cachePath = path.join(this.baseDir, CACHE_DIR, LLM_CACHE_DIR, `${promptHash}.json`);
    if (!fs.existsSync(cachePath)) return null;
    
    try {
      const entry: CacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      
      // Check expiration
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        fs.unlinkSync(cachePath);
        return null;
      }
      
      // Update hits
      entry.hits++;
      fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
      
      return entry.value;
    } catch {
      return null;
    }
  }
  
  /**
   * Set LLM cache.
   */
  async setLLMCache(promptHash: string, value: unknown, ttlMs?: number): Promise<void> {
    const cachePath = path.join(this.baseDir, CACHE_DIR, LLM_CACHE_DIR, `${promptHash}.json`);
    
    const entry: CacheEntry = {
      key: promptHash,
      value,
      createdAt: new Date().toISOString(),
      expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : undefined,
      hits: 0,
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
  }
  
  /**
   * Get cached reference data.
   */
  async getRefsCache(key: string): Promise<unknown | null> {
    const cachePath = path.join(this.baseDir, CACHE_DIR, REFS_CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(cachePath)) return null;
    
    try {
      const entry: CacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      
      // Check expiration (24 hour TTL for refs per TDD)
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        fs.unlinkSync(cachePath);
        return null;
      }
      
      return entry.value;
    } catch {
      return null;
    }
  }
  
  /**
   * Set reference data cache (24 hour TTL).
   */
  async setRefsCache(key: string, value: unknown): Promise<void> {
    const cachePath = path.join(this.baseDir, CACHE_DIR, REFS_CACHE_DIR, `${key}.json`);
    
    const TTL_24_HOURS = 24 * 60 * 60 * 1000;
    const entry: CacheEntry = {
      key,
      value,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TTL_24_HOURS).toISOString(),
      hits: 0,
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
  }
  
  /**
   * Clear all caches.
   */
  async clearCache(): Promise<void> {
    const llmCacheDir = path.join(this.baseDir, CACHE_DIR, LLM_CACHE_DIR);
    const refsCacheDir = path.join(this.baseDir, CACHE_DIR, REFS_CACHE_DIR);
    
    for (const dir of [llmCacheDir, refsCacheDir]) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file));
        }
      }
    }
  }
  
  // ===========================================================================
  // LOGGING
  // ===========================================================================
  
  /**
   * Log a message for a run.
   */
  log(runId: string, message: string): void {
    const logPath = path.join(this.baseDir, LOGS_DIR, `${runId}.log`);
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  }
  
  /**
   * Get logs for a run.
   */
  getLogs(runId: string): string[] {
    const logPath = path.join(this.baseDir, LOGS_DIR, `${runId}.log`);
    if (!fs.existsSync(logPath)) return [];
    
    return fs.readFileSync(logPath, 'utf-8').trim().split('\n');
  }
  
  // ===========================================================================
  // HELPERS
  // ===========================================================================
  
  /**
   * Compute inputs hash for run identity (TDD v1.3 Section 6.3).
   */
  private computeInputsHash(
    repoRoot: string,
    eventsFile?: string,
    refsVersion?: string
  ): string {
    const inputs = {
      repoRoot: path.resolve(repoRoot),
      eventsHash: eventsFile ? this.hashFile(eventsFile) : null,
      toolVersions: PEAKINFER_VERSION,
      refsVersion: refsVersion || 'latest',
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(inputs))
      .digest('hex');
  }
  
  /**
   * Hash a file's contents.
   */
  private hashFile(filePath: string): string {
    if (!fs.existsSync(filePath)) return 'not_found';
    
    const content = fs.readFileSync(filePath);
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Ensure directory exists.
   */
  private async ensureDir(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  
  /**
   * Get the base .peakinfer directory path.
   */
  getBaseDir(): string {
    return this.baseDir;
  }
  
  /**
   * Get current run ID.
   */
  getCurrentRunId(): string | null {
    return this.currentRunId;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { PEAKINFER_DIR, PEAKINFER_VERSION };

