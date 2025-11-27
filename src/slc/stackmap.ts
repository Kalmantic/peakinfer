/**
 * StackMap Builder Module — Hierarchical Callsite Mapping
 *
 * Responsibility (per PRD v0.95):
 * - Build tree structure from classified callsites
 * - Group by directory → file → callsites
 * - Generate summary (providers, models, totals)
 *
 * Design: Pure function, no side effects.
 */

import type { ClassifiedCallsite, StackMap, StackMapNode, StackMapCallsite } from './types.js';

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Build a StackMap from classified callsites.
 *
 * @param callsites - Array of classified callsites from detector
 * @param root - Root directory path
 * @returns Complete StackMap structure
 */
export function buildStackMap(callsites: ClassifiedCallsite[], root: string): StackMap {
  // Group callsites by file path
  const byFile = groupByFile(callsites);

  // Build tree structure
  const tree = buildTree(byFile);

  // Generate summary
  const summary = buildSummary(callsites);

  return { root, tree, summary };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Group callsites by file path.
 */
function groupByFile(callsites: ClassifiedCallsite[]): Map<string, ClassifiedCallsite[]> {
  const map = new Map<string, ClassifiedCallsite[]>();

  for (const cs of callsites) {
    const existing = map.get(cs.file) || [];
    existing.push(cs);
    map.set(cs.file, existing);
  }

  return map;
}

/**
 * Build hierarchical tree from file groups.
 */
function buildTree(byFile: Map<string, ClassifiedCallsite[]>): StackMapNode[] {
  const root: Map<string, StackMapNode> = new Map();

  for (const [filePath, callsites] of byFile) {
    const parts = filePath.split('/');
    insertPath(root, parts, filePath, callsites);
  }

  return Array.from(root.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Insert a file path into the tree, creating directory nodes as needed.
 */
function insertPath(
  nodes: Map<string, StackMapNode>,
  parts: string[],
  fullPath: string,
  callsites: ClassifiedCallsite[]
): void {
  if (parts.length === 0) return;

  const [first, ...rest] = parts;

  if (!nodes.has(first)) {
    const isFile = rest.length === 0;
    nodes.set(first, {
      name: first,
      path: isFile ? fullPath : first,
      type: isFile ? 'file' : 'directory',
      ...(isFile ? { callsites: [] } : { children: [] }),
    });
  }

  const node = nodes.get(first)!;

  if (rest.length === 0) {
    // Leaf node (file) — add callsites sorted by line
    node.callsites = callsites
      .sort((a, b) => a.line - b.line)
      .map(toStackMapCallsite);
  } else {
    // Directory node — recurse
    if (!node.children) {
      node.children = [];
    }
    const childMap = new Map<string, StackMapNode>(node.children.map((c: StackMapNode) => [c.name, c]));
    insertPath(childMap, rest, fullPath, callsites);
    node.children = Array.from(childMap.values()).sort((a: StackMapNode, b: StackMapNode) => a.name.localeCompare(b.name));
  }
}

/**
 * Convert ClassifiedCallsite to StackMapCallsite.
 */
function toStackMapCallsite(cs: ClassifiedCallsite): StackMapCallsite {
  return {
    line: cs.line,
    pattern: buildPattern(cs),
    provider: cs.provider || 'unknown',
    model: cs.model,
  };
}

/**
 * Build a human-readable pattern string for a callsite.
 */
function buildPattern(cs: ClassifiedCallsite): string {
  const parts: string[] = [];

  if (cs.framework) parts.push(cs.framework);
  if (cs.provider) parts.push(cs.provider);
  if (cs.taskKind) parts.push(cs.taskKind);

  return parts.join('.') || 'unknown';
}

/**
 * Build summary from all callsites.
 */
function buildSummary(callsites: ClassifiedCallsite[]): StackMap['summary'] {
  const providers = new Set<string>();
  const models = new Set<string>();

  for (const cs of callsites) {
    if (cs.provider) providers.add(cs.provider);
    if (cs.model) models.add(cs.model);
  }

  return {
    totalCallsites: callsites.length,
    providers: Array.from(providers).sort(),
    models: Array.from(models).sort(),
  };
}
