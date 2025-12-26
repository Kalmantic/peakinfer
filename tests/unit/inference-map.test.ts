/**
 * InferenceMap Tests
 * Per Test Cases v1.9.3 - Core Analysis Tests
 */
import { describe, test, expect } from 'vitest';

// InferenceMap types (from inferencemap-spec.md)
interface InferencePoint {
  id: string;
  file: string;
  line: number;
  function?: string;
  provider: string;
  model: string;
  streaming?: boolean;
  costProfile?: {
    estimatedCostPer1K?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'cost' | 'latency' | 'throughput' | 'reliability' | 'drift';
  title: string;
  description: string;
  file: string;
  line: number;
  impact?: string;
  fix?: {
    description: string;
    effort?: string;
    code?: string;
  };
}

interface InferenceMap {
  version: string;
  generated: string;
  inferencePoints: InferencePoint[];
  issues: Issue[];
  summary: {
    totalInferencePoints: number;
    providers: string[];
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues?: number;
  };
}

// InferenceMap utilities
function createInferenceMap(
  points: InferencePoint[],
  issues: Issue[]
): InferenceMap {
  const providers = [...new Set(points.map(p => p.provider))];

  return {
    version: '0.1',
    generated: new Date().toISOString(),
    inferencePoints: points,
    issues,
    summary: {
      totalInferencePoints: points.length,
      providers,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
    },
  };
}

function mergeInferenceMaps(maps: InferenceMap[]): InferenceMap {
  const allPoints = maps.flatMap(m => m.inferencePoints);
  const allIssues = maps.flatMap(m => m.issues);
  const providers = [...new Set(allPoints.map(p => p.provider))];

  return {
    version: '0.1',
    generated: new Date().toISOString(),
    inferencePoints: allPoints,
    issues: allIssues,
    summary: {
      totalInferencePoints: allPoints.length,
      providers,
      criticalIssues: allIssues.filter(i => i.severity === 'critical').length,
      highIssues: allIssues.filter(i => i.severity === 'high').length,
      mediumIssues: allIssues.filter(i => i.severity === 'medium').length,
      lowIssues: allIssues.filter(i => i.severity === 'low').length,
    },
  };
}

function filterByFile(map: InferenceMap, file: string): InferenceMap {
  const points = map.inferencePoints.filter(p => p.file === file);
  const issues = map.issues.filter(i => i.file === file);
  return createInferenceMap(points, issues);
}

function filterBySeverity(
  map: InferenceMap,
  minSeverity: 'critical' | 'high' | 'medium' | 'low'
): InferenceMap {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const minLevel = severityOrder[minSeverity];

  const issues = map.issues.filter(i => severityOrder[i.severity] <= minLevel);
  return createInferenceMap(map.inferencePoints, issues);
}

function filterByCategory(
  map: InferenceMap,
  category: 'cost' | 'latency' | 'throughput' | 'reliability' | 'drift'
): InferenceMap {
  const issues = map.issues.filter(i => i.category === category);
  return createInferenceMap(map.inferencePoints, issues);
}

describe('InferenceMap Creation', () => {
  test('Creates valid InferenceMap from points and issues', () => {
    const points: InferencePoint[] = [
      { id: 'ip-1', file: 'src/chat.ts', line: 42, provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { id: 'ip-2', file: 'src/embed.ts', line: 15, provider: 'openai', model: 'text-embedding-ada-002' },
    ];

    const issues: Issue[] = [
      {
        id: 'issue-1',
        severity: 'high',
        category: 'cost',
        title: 'Expensive model',
        description: 'Using expensive model',
        file: 'src/chat.ts',
        line: 42,
      },
    ];

    const map = createInferenceMap(points, issues);

    expect(map.version).toBe('0.1');
    expect(map.inferencePoints).toHaveLength(2);
    expect(map.issues).toHaveLength(1);
    expect(map.summary.totalInferencePoints).toBe(2);
    expect(map.summary.providers).toContain('anthropic');
    expect(map.summary.providers).toContain('openai');
    expect(map.summary.highIssues).toBe(1);
  });

  test('Handles empty inputs', () => {
    const map = createInferenceMap([], []);

    expect(map.inferencePoints).toHaveLength(0);
    expect(map.issues).toHaveLength(0);
    expect(map.summary.totalInferencePoints).toBe(0);
    expect(map.summary.providers).toHaveLength(0);
  });

  test('Deduplicates providers in summary', () => {
    const points: InferencePoint[] = [
      { id: 'ip-1', file: 'a.ts', line: 1, provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { id: 'ip-2', file: 'b.ts', line: 1, provider: 'anthropic', model: 'claude-haiku-3-20240307' },
      { id: 'ip-3', file: 'c.ts', line: 1, provider: 'openai', model: 'gpt-4' },
    ];

    const map = createInferenceMap(points, []);

    expect(map.summary.providers).toHaveLength(2);
    expect(map.summary.providers).toContain('anthropic');
    expect(map.summary.providers).toContain('openai');
  });
});

describe('InferenceMap Merging', () => {
  test('Merges multiple maps', () => {
    const map1 = createInferenceMap(
      [{ id: 'ip-1', file: 'a.ts', line: 1, provider: 'anthropic', model: 'claude-sonnet-4-20250514' }],
      [{ id: 'i-1', severity: 'high', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 1 }]
    );

    const map2 = createInferenceMap(
      [{ id: 'ip-2', file: 'b.ts', line: 1, provider: 'openai', model: 'gpt-4' }],
      [{ id: 'i-2', severity: 'critical', category: 'latency', title: 'T2', description: 'D2', file: 'b.ts', line: 1 }]
    );

    const merged = mergeInferenceMaps([map1, map2]);

    expect(merged.inferencePoints).toHaveLength(2);
    expect(merged.issues).toHaveLength(2);
    expect(merged.summary.totalInferencePoints).toBe(2);
    expect(merged.summary.criticalIssues).toBe(1);
    expect(merged.summary.highIssues).toBe(1);
  });

  test('Handles empty map in merge', () => {
    const map1 = createInferenceMap(
      [{ id: 'ip-1', file: 'a.ts', line: 1, provider: 'anthropic', model: 'claude-sonnet-4-20250514' }],
      []
    );

    const map2 = createInferenceMap([], []);

    const merged = mergeInferenceMaps([map1, map2]);

    expect(merged.inferencePoints).toHaveLength(1);
    expect(merged.issues).toHaveLength(0);
  });
});

describe('InferenceMap Filtering', () => {
  const testMap: InferenceMap = createInferenceMap(
    [
      { id: 'ip-1', file: 'src/chat.ts', line: 10, provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { id: 'ip-2', file: 'src/embed.ts', line: 20, provider: 'openai', model: 'ada' },
      { id: 'ip-3', file: 'src/chat.ts', line: 30, provider: 'anthropic', model: 'claude-haiku-3-20240307' },
    ],
    [
      { id: 'i-1', severity: 'critical', category: 'cost', title: 'T1', description: 'D1', file: 'src/chat.ts', line: 10 },
      { id: 'i-2', severity: 'high', category: 'latency', title: 'T2', description: 'D2', file: 'src/embed.ts', line: 20 },
      { id: 'i-3', severity: 'medium', category: 'drift', title: 'T3', description: 'D3', file: 'src/chat.ts', line: 30 },
    ]
  );

  test('Filters by file', () => {
    const filtered = filterByFile(testMap, 'src/chat.ts');

    expect(filtered.inferencePoints).toHaveLength(2);
    expect(filtered.issues).toHaveLength(2);
    expect(filtered.inferencePoints.every(p => p.file === 'src/chat.ts')).toBe(true);
  });

  test('Filters by severity (critical only)', () => {
    const filtered = filterBySeverity(testMap, 'critical');

    expect(filtered.issues).toHaveLength(1);
    expect(filtered.issues[0].severity).toBe('critical');
  });

  test('Filters by severity (high and above)', () => {
    const filtered = filterBySeverity(testMap, 'high');

    expect(filtered.issues).toHaveLength(2);
    expect(filtered.issues.every(i => ['critical', 'high'].includes(i.severity))).toBe(true);
  });

  test('Filters by category', () => {
    const filtered = filterByCategory(testMap, 'cost');

    expect(filtered.issues).toHaveLength(1);
    expect(filtered.issues[0].category).toBe('cost');
  });
});

describe('InferenceMap Summary', () => {
  test('Correctly counts issues by severity', () => {
    const issues: Issue[] = [
      { id: 'i-1', severity: 'critical', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 1 },
      { id: 'i-2', severity: 'critical', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 2 },
      { id: 'i-3', severity: 'high', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 3 },
      { id: 'i-4', severity: 'medium', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 4 },
      { id: 'i-5', severity: 'medium', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 5 },
      { id: 'i-6', severity: 'medium', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 6 },
      { id: 'i-7', severity: 'low', category: 'cost', title: 'T', description: 'D', file: 'a.ts', line: 7 },
    ];

    const map = createInferenceMap([], issues);

    expect(map.summary.criticalIssues).toBe(2);
    expect(map.summary.highIssues).toBe(1);
    expect(map.summary.mediumIssues).toBe(3);
    expect(map.summary.lowIssues).toBe(1);
  });
});
