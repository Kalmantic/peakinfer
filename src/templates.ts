import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYAML } from 'yaml';
import { InsightTemplate } from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATES_REPO = 'https://raw.githubusercontent.com/Kalmantic/peakinfer_templates/main';
const MANIFEST_URL = `${TEMPLATES_REPO}/insights/manifest.json`;
const CACHE_DIR = '.peakinfer/cache/templates';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get bundled templates directory (relative to this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUNDLED_DIR = join(__dirname, '..', 'templates');

// =============================================================================
// TYPES
// =============================================================================

interface Manifest {
  version: string;
  templates: string[];
  updated: string;
}

interface CacheMeta {
  fetchedAt: number;
  version: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getCacheDir(): string {
  return join(process.cwd(), CACHE_DIR);
}

function getCacheMetaPath(): string {
  return join(getCacheDir(), 'meta.json');
}

function isCacheValid(): boolean {
  const metaPath = getCacheMetaPath();
  if (!existsSync(metaPath)) return false;

  try {
    const meta: CacheMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return Date.now() - meta.fetchedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function findYamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findYamlFiles(fullPath));
    } else if (entry.name.endsWith('.yaml')) {
      results.push(fullPath);
    }
  }

  return results;
}

function loadCachedTemplates(): InsightTemplate[] {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) return [];

  const templates: InsightTemplate[] = [];
  const files = findYamlFiles(cacheDir);

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const parsed = parseYAML(content);
      const validated = InsightTemplate.parse(parsed);
      templates.push(validated);
    } catch {
      // Skip invalid templates
    }
  }

  return templates;
}

function loadBundledTemplates(): InsightTemplate[] {
  if (!existsSync(BUNDLED_DIR)) return [];

  const templates: InsightTemplate[] = [];
  const files = readdirSync(BUNDLED_DIR).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    try {
      const content = readFileSync(join(BUNDLED_DIR, file), 'utf-8');
      const parsed = parseYAML(content);
      const validated = InsightTemplate.parse(parsed);
      templates.push(validated);
    } catch {
      // Skip invalid templates
    }
  }

  return templates;
}

async function fetchManifest(): Promise<Manifest | null> {
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) return null;
    return await response.json() as Manifest;
  } catch {
    return null;
  }
}

async function fetchTemplate(templatePath: string): Promise<string | null> {
  try {
    // Templates are now in insights/{category}/{name}.yaml
    const url = `${TEMPLATES_REPO}/insights/${templatePath}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function saveToCache(templates: Map<string, string>, version: string): void {
  const cacheDir = getCacheDir();
  mkdirSync(cacheDir, { recursive: true });

  // Save each template (handle nested paths like cost/prompt-bloat.yaml)
  for (const [name, content] of templates) {
    const filePath = join(cacheDir, name);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }

  // Save meta
  const meta: CacheMeta = {
    fetchedAt: Date.now(),
    version,
  };
  writeFileSync(getCacheMetaPath(), JSON.stringify(meta, null, 2));
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface LoadOptions {
  offline?: boolean;
}

export async function loadTemplates(opts: LoadOptions = {}): Promise<InsightTemplate[]> {
  // If offline mode, skip remote fetch
  if (opts.offline) {
    const cached = loadCachedTemplates();
    if (cached.length > 0) return cached;
    return loadBundledTemplates();
  }

  // Check cache validity
  if (isCacheValid()) {
    const cached = loadCachedTemplates();
    if (cached.length > 0) return cached;
  }

  // Try to fetch from remote
  const manifest = await fetchManifest();
  if (manifest) {
    const templateContents = new Map<string, string>();
    const templates: InsightTemplate[] = [];

    for (const templatePath of manifest.templates) {
      const content = await fetchTemplate(templatePath);
      if (content) {
        templateContents.set(templatePath, content);
        try {
          const parsed = parseYAML(content);
          const validated = InsightTemplate.parse(parsed);
          templates.push(validated);
        } catch {
          // Skip invalid templates
        }
      }
    }

    if (templates.length > 0) {
      saveToCache(templateContents, manifest.version);
      return templates;
    }
  }

  // Fall back to stale cache
  const cached = loadCachedTemplates();
  if (cached.length > 0) {
    console.warn('[templates] Using stale cache');
    return cached;
  }

  // Fall back to bundled templates
  console.warn('[templates] Using bundled templates');
  return loadBundledTemplates();
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: string, opts: LoadOptions = {}): Promise<InsightTemplate | null> {
  const templates = await loadTemplates(opts);
  return templates.find(t => t.id === id) || null;
}

/**
 * Clear template cache
 */
export function clearCache(): void {
  const cacheDir = getCacheDir();
  if (existsSync(cacheDir)) {
    const files = readdirSync(cacheDir);
    for (const file of files) {
      const filePath = join(cacheDir, file);
      try {
        readFileSync(filePath); // Check if readable
        writeFileSync(filePath, ''); // Clear content
      } catch {
        // Skip
      }
    }
  }
}
