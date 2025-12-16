/**
 * Remote Templates - PeakInfer TDD v1.3 Section 17.4
 * 
 * Fetches evaluation templates from GitHub for consistent benchmarking.
 * 
 * Template sources:
 * - kalmantic/peakinfer-templates (primary)
 * - Local cache for offline access
 * - Fallback to bundled templates
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// =============================================================================
// CONFIGURATION
// =============================================================================

const TEMPLATE_REPO = 'kalmantic/peakinfer-templates';
const TEMPLATE_BRANCH = 'main';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${TEMPLATE_REPO}/${TEMPLATE_BRANCH}`;

const CACHE_DIR = '.peakinfer/templates';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

/**
 * Template for static analysis ground truth.
 */
export interface StaticAnalysisTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  
  /** Test fixture path */
  fixturePath: string;
  
  /** Expected callsites */
  expectedCallsites: Array<{
    file: string;
    line: number;
    provider: string;
    model: string | null;
    pattern: string;
    confidence: number;
  }>;
  
  /** Non-callsites (negative examples) */
  nonCallsites: Array<{
    file: string;
    line: number;
    reason: string;
  }>;
  
  /** Quality gates */
  qualityGates: {
    minPrecision: number;
    minRecall: number;
    minF1: number;
  };
}

/**
 * Template for format detection.
 */
export interface FormatDetectionTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  
  /** Test fixture path */
  fixturePath: string;
  
  /** Expected format */
  expectedFormat: string;
  
  /** Expected field mappings */
  expectedMappings: Array<{
    targetField: string;
    sourceExpression: string;
    confidence: number;
  }>;
  
  /** Sample extracted values for validation */
  sampleValues: Record<string, unknown[]>;
  
  /** Quality gates */
  qualityGates: {
    minFormatConfidence: number;
    minMappingConfidence: number;
    maxUnmappedRequired: number;
  };
}

/**
 * Template for drift detection.
 */
export interface DriftDetectionTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  
  /** Static analysis fixture */
  staticFixture: string;
  
  /** Runtime events fixture */
  runtimeFixture: string;
  
  /** Expected drift signals */
  expectedDrift: {
    codeOnlyCallsites: number;
    runtimeOnlyEvents: number;
    modelMismatches: number;
    providerMismatches: number;
    patternMismatches: number;
  };
  
  /** Quality gates */
  qualityGates: {
    minDriftPrecision: number;
    minDriftRecall: number;
  };
}

/**
 * Combined template manifest.
 */
export interface TemplateManifest {
  version: string;
  lastUpdated: string;
  
  staticAnalysis: StaticAnalysisTemplate[];
  formatDetection: FormatDetectionTemplate[];
  driftDetection: DriftDetectionTemplate[];
  
  /** SHA of last commit */
  commitSha?: string;
}

// =============================================================================
// TEMPLATE FETCHING
// =============================================================================

/**
 * Fetch data from URL with timeout.
 */
function fetchUrl(url: string, timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode === 404) {
        reject(new Error(`Not found: ${url}`));
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Get cache file path.
 */
function getCachePath(cacheDir: string, filename: string): string {
  return path.join(cacheDir, filename);
}

/**
 * Check if cache is valid.
 */
function isCacheValid(cachePath: string, ttlMs: number): boolean {
  try {
    const stat = fs.statSync(cachePath);
    return Date.now() - stat.mtimeMs < ttlMs;
  } catch {
    return false;
  }
}

/**
 * Read from cache.
 */
function readCache<T>(cachePath: string): T | null {
  try {
    const data = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Write to cache.
 */
function writeCache(cachePath: string, data: unknown): void {
  try {
    const dir = path.dirname(cachePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('Failed to write cache:', error);
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Fetch template manifest from GitHub.
 */
export async function fetchTemplateManifest(
  cacheDir = CACHE_DIR
): Promise<TemplateManifest | null> {
  const cachePath = getCachePath(cacheDir, 'manifest.json');
  
  // Check cache first
  if (isCacheValid(cachePath, CACHE_TTL_MS)) {
    const cached = readCache<TemplateManifest>(cachePath);
    if (cached) return cached;
  }
  
  // Fetch from GitHub
  try {
    const manifestUrl = `${GITHUB_RAW_URL}/manifest.json`;
    const data = await fetchUrl(manifestUrl);
    const manifest = JSON.parse(data) as TemplateManifest;
    
    // Update cache
    writeCache(cachePath, manifest);
    
    return manifest;
  } catch (error) {
    console.warn('Failed to fetch template manifest:', error);
    
    // Return cached even if expired
    const cached = readCache<TemplateManifest>(cachePath);
    if (cached) {
      console.warn('Using expired cache');
      return cached;
    }
    
    return null;
  }
}

/**
 * Fetch a specific static analysis template.
 */
export async function fetchStaticTemplate(
  templateId: string,
  cacheDir = CACHE_DIR
): Promise<StaticAnalysisTemplate | null> {
  const cachePath = getCachePath(cacheDir, `static/${templateId}.json`);
  
  // Check cache first
  if (isCacheValid(cachePath, CACHE_TTL_MS)) {
    const cached = readCache<StaticAnalysisTemplate>(cachePath);
    if (cached) return cached;
  }
  
  // Fetch from GitHub
  try {
    const url = `${GITHUB_RAW_URL}/templates/static/${templateId}.json`;
    const data = await fetchUrl(url);
    const template = JSON.parse(data) as StaticAnalysisTemplate;
    
    writeCache(cachePath, template);
    
    return template;
  } catch (error) {
    console.warn(`Failed to fetch static template ${templateId}:`, error);
    return readCache<StaticAnalysisTemplate>(cachePath);
  }
}

/**
 * Fetch a specific format detection template.
 */
export async function fetchFormatTemplate(
  templateId: string,
  cacheDir = CACHE_DIR
): Promise<FormatDetectionTemplate | null> {
  const cachePath = getCachePath(cacheDir, `format/${templateId}.json`);
  
  // Check cache first
  if (isCacheValid(cachePath, CACHE_TTL_MS)) {
    const cached = readCache<FormatDetectionTemplate>(cachePath);
    if (cached) return cached;
  }
  
  // Fetch from GitHub
  try {
    const url = `${GITHUB_RAW_URL}/templates/format/${templateId}.json`;
    const data = await fetchUrl(url);
    const template = JSON.parse(data) as FormatDetectionTemplate;
    
    writeCache(cachePath, template);
    
    return template;
  } catch (error) {
    console.warn(`Failed to fetch format template ${templateId}:`, error);
    return readCache<FormatDetectionTemplate>(cachePath);
  }
}

/**
 * Fetch a specific drift detection template.
 */
export async function fetchDriftTemplate(
  templateId: string,
  cacheDir = CACHE_DIR
): Promise<DriftDetectionTemplate | null> {
  const cachePath = getCachePath(cacheDir, `drift/${templateId}.json`);
  
  // Check cache first
  if (isCacheValid(cachePath, CACHE_TTL_MS)) {
    const cached = readCache<DriftDetectionTemplate>(cachePath);
    if (cached) return cached;
  }
  
  // Fetch from GitHub
  try {
    const url = `${GITHUB_RAW_URL}/templates/drift/${templateId}.json`;
    const data = await fetchUrl(url);
    const template = JSON.parse(data) as DriftDetectionTemplate;
    
    writeCache(cachePath, template);
    
    return template;
  } catch (error) {
    console.warn(`Failed to fetch drift template ${templateId}:`, error);
    return readCache<DriftDetectionTemplate>(cachePath);
  }
}

/**
 * Fetch fixture file.
 */
export async function fetchFixture(
  fixturePath: string,
  cacheDir = CACHE_DIR
): Promise<string | null> {
  const cachePath = getCachePath(cacheDir, `fixtures/${fixturePath}`);
  
  // Check cache first
  if (isCacheValid(cachePath, CACHE_TTL_MS)) {
    try {
      return fs.readFileSync(cachePath, 'utf-8');
    } catch {
      // Fall through to fetch
    }
  }
  
  // Fetch from GitHub
  try {
    const url = `${GITHUB_RAW_URL}/fixtures/${fixturePath}`;
    const data = await fetchUrl(url);
    
    // Cache the fixture
    const dir = path.dirname(cachePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath, data);
    
    return data;
  } catch (error) {
    console.warn(`Failed to fetch fixture ${fixturePath}:`, error);
    
    // Try cache even if expired
    try {
      return fs.readFileSync(cachePath, 'utf-8');
    } catch {
      return null;
    }
  }
}

/**
 * Clear template cache.
 */
export function clearCache(cacheDir = CACHE_DIR): void {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
}

/**
 * Get cache status.
 */
export function getCacheStatus(cacheDir = CACHE_DIR): {
  exists: boolean;
  size: number;
  age: number | null;
  manifestVersion: string | null;
} {
  const cachePath = getCachePath(cacheDir, 'manifest.json');
  
  try {
    const stat = fs.statSync(cacheDir);
    const manifest = readCache<TemplateManifest>(cachePath);
    
    let totalSize = 0;
    const calcSize = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          calcSize(fullPath);
        } else {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    };
    
    calcSize(cacheDir);
    
    return {
      exists: true,
      size: totalSize,
      age: Date.now() - stat.mtimeMs,
      manifestVersion: manifest?.version || null,
    };
  } catch {
    return {
      exists: false,
      size: 0,
      age: null,
      manifestVersion: null,
    };
  }
}

// =============================================================================
// BUNDLED FALLBACK TEMPLATES
// =============================================================================

/**
 * Bundled static analysis templates (offline fallback).
 */
export const BUNDLED_STATIC_TEMPLATES: StaticAnalysisTemplate[] = [
  {
    id: 'r1-openai-simple',
    name: 'OpenAI Simple SDK',
    description: 'Basic OpenAI SDK usage patterns',
    version: '1.0.0',
    fixturePath: 'repos/r1-openai-simple',
    expectedCallsites: [
      {
        file: 'src/chat.py',
        line: 15,
        provider: 'openai',
        model: 'gpt-4o',
        pattern: 'chat',
        confidence: 1.0,
      },
    ],
    nonCallsites: [],
    qualityGates: {
      minPrecision: 0.95,
      minRecall: 0.90,
      minF1: 0.92,
    },
  },
  {
    id: 'r2-anthropic-streaming',
    name: 'Anthropic Streaming',
    description: 'Anthropic SDK with streaming responses',
    version: '1.0.0',
    fixturePath: 'repos/r2-anthropic-streaming',
    expectedCallsites: [
      {
        file: 'app.ts',
        line: 22,
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        pattern: 'stream',
        confidence: 1.0,
      },
    ],
    nonCallsites: [],
    qualityGates: {
      minPrecision: 0.95,
      minRecall: 0.90,
      minF1: 0.92,
    },
  },
];

/**
 * Bundled format detection templates (offline fallback).
 */
export const BUNDLED_FORMAT_TEMPLATES: FormatDetectionTemplate[] = [
  {
    id: 'f1-jsonl-baseline',
    name: 'JSONL Baseline',
    description: 'Standard JSONL inference events',
    version: '1.0.0',
    fixturePath: 'events/f1-jsonl-baseline.jsonl',
    expectedFormat: 'jsonl',
    expectedMappings: [
      { targetField: 'id', sourceExpression: 'id', confidence: 1.0 },
      { targetField: 'ts', sourceExpression: 'ts', confidence: 1.0 },
      { targetField: 'provider', sourceExpression: 'provider', confidence: 1.0 },
      { targetField: 'model', sourceExpression: 'model', confidence: 1.0 },
    ],
    sampleValues: {},
    qualityGates: {
      minFormatConfidence: 0.95,
      minMappingConfidence: 0.90,
      maxUnmappedRequired: 0,
    },
  },
];

/**
 * Get bundled templates as fallback.
 */
export function getBundledTemplates(): TemplateManifest {
  return {
    version: '1.0.0-bundled',
    lastUpdated: new Date().toISOString(),
    staticAnalysis: BUNDLED_STATIC_TEMPLATES,
    formatDetection: BUNDLED_FORMAT_TEMPLATES,
    driftDetection: [],
  };
}

