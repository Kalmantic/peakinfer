/**
 * Codebase Collector - Language-Agnostic Code Scanner
 * Scans target codebases to identify LLM API calls, configurations, and optimization opportunities
 * Based on PRD v0.7: Codebase Analysis Architecture
 */

import { BaseCollector } from './base-collector.js';
import { InferenceEvent } from '../types/events.js';
import { CollectorValidationResult } from '../types/collectors.js';
import {
  CodebaseAnalysis,
  LLMAPICall,
  ModelUsagePattern,
  ConfigFile,
  CachingOpportunity,
  CodeOptimization,
  IntegrationPoint,
  CodeMetrics,
  CodebaseScanOptions,
  FileAnalysis,
  LanguagePatterns
} from '../types/codebase.js';
import { HardwareDetector } from './hardware-detector.js';
import fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';

export class CodebaseCollector extends BaseCollector {
  private scanOptions: CodebaseScanOptions;
  private languagePatterns: LanguagePatterns[];
  private startTime: number = 0;

  constructor(scanOptions: CodebaseScanOptions) {
    super('codebase', {
      trustBoundaries: {
        noNetworkEgress: true,
        leastPrivilege: true,
        auditableCode: true,
        noPIIExfiltration: true,
      },
      outputFormat: 'events.jsonl',
      normalization: 'canonical_schema',
    });
    
    this.scanOptions = {
      maxFileSize: 1024 * 1024, // 1MB default
      maxFiles: 50000,
      scanDepth: 'normal',
      followSymlinks: false,
      ...scanOptions
    };
    
    this.languagePatterns = this.initializeLanguagePatterns();
  }

  /**
   * Main collection method - scans codebase and returns analysis
   */
  async collect(): Promise<InferenceEvent[]> {
    // This collector doesn't return InferenceEvents, but we need to satisfy the interface
    // The actual codebase analysis is done through analyzeCodebase()
    console.log('  ℹ️  Use analyzeCodebase() method for codebase scanning');
    return [];
  }

  /**
   * Analyze codebase and return comprehensive analysis
   */
  async analyzeCodebase(): Promise<CodebaseAnalysis> {
    this.startTime = Date.now();
    console.log(`\n🔍 Scanning codebase: ${this.scanOptions.rootPath}\n`);

    const analysis: CodebaseAnalysis = {
      llmApiCalls: [],
      modelUsagePatterns: [],
      configurationFiles: [],
      cachingOpportunities: [],
      optimizationOpportunities: [],
      integrationPoints: [],
      codeMetrics: {
        totalFiles: 0,
        filesWithLLMCalls: 0,
        totalLLMCalls: 0,
        estimatedMonthlyCalls: 0,
        potentialCacheableCalls: 0,
        codebaseLanguages: [],
        totalLinesScanned: 0,
        scanDurationMs: 0,
        providerDistribution: {},
        modelDistribution: {}
      }
    };

    try {
      // Load ignore patterns
      const ignorePatterns = await this.loadIgnorePatterns();
      
      // Find all files to scan
      const files = await this.findFilesToScan(ignorePatterns);
      analysis.codeMetrics.totalFiles = files.length;
      
      console.log(`  📁 Found ${files.length} files to scan`);
      
      // Analyze each file
      let filesScanned = 0;
      const languages = new Set<string>();
      
      for (const file of files) {
        try {
          const fileAnalysis = await this.analyzeFile(file);
          
          if (fileAnalysis) {
            // Collect LLM API calls
            analysis.llmApiCalls.push(...fileAnalysis.llmApiCalls);
            
            // Track languages
            if (fileAnalysis.language) {
              languages.add(fileAnalysis.language);
            }
            
            // Track lines scanned
            analysis.codeMetrics.totalLinesScanned += fileAnalysis.linesOfCode;
            
            // Track files with LLM calls
            if (fileAnalysis.llmApiCalls.length > 0) {
              analysis.codeMetrics.filesWithLLMCalls++;
            }
            
            // Identify caching opportunities
            if (fileAnalysis.llmApiCalls.length > 0 && !fileAnalysis.hasCaching) {
              analysis.cachingOpportunities.push(...this.identifyCachingOpportunities(fileAnalysis));
            }
            
            // Identify optimization opportunities
            analysis.optimizationOpportunities.push(...this.identifyOptimizations(fileAnalysis));
            
            // Check if it's a config file
            if (fileAnalysis.configType) {
              analysis.configurationFiles.push(await this.analyzeConfigFile(file, fileAnalysis.configType));
            }
            
            // Detect integration points
            analysis.integrationPoints.push(...this.detectIntegrationPoints(fileAnalysis));
          }
          
          filesScanned++;
          if (filesScanned % 100 === 0) {
            console.log(`  📊 Progress: ${filesScanned}/${files.length} files scanned`);
          }
        } catch (error) {
          console.warn(`  ⚠️  Failed to analyze ${file}:`, error instanceof Error ? error.message : String(error));
        }
      }
      
      console.log(`\n  ✅ Scanned ${filesScanned} files`);
      
      // Aggregate model usage patterns
      analysis.modelUsagePatterns = this.aggregateModelUsage(analysis.llmApiCalls);
      
      // Finalize metrics
      analysis.codeMetrics.codebaseLanguages = Array.from(languages);
      analysis.codeMetrics.totalLLMCalls = analysis.llmApiCalls.length;
      analysis.codeMetrics.potentialCacheableCalls = analysis.cachingOpportunities.reduce((sum, opp) => sum + opp.affectedCalls, 0);
      analysis.codeMetrics.scanDurationMs = Date.now() - this.startTime;
      
      // Calculate provider and model distribution
      for (const call of analysis.llmApiCalls) {
        analysis.codeMetrics.providerDistribution[call.apiProvider] = 
          (analysis.codeMetrics.providerDistribution[call.apiProvider] || 0) + 1;
        if (call.model) {
          analysis.codeMetrics.modelDistribution[call.model] = 
            (analysis.codeMetrics.modelDistribution[call.model] || 0) + 1;
        }
      }
      
      // Estimate monthly calls (heuristic: 1000 calls per detected API call location)
      analysis.codeMetrics.estimatedMonthlyCalls = analysis.llmApiCalls.length * 1000;

      // Run hardware detection
      console.log('\n  🔧 Detecting hardware configuration...');
      try {
        const hardwareDetector = new HardwareDetector(this.scanOptions.rootPath, false);
        analysis.hardwareProfile = await hardwareDetector.detect();

        if (analysis.hardwareProfile.summary.totalGPUs > 0) {
          console.log(`  ✅ Found ${analysis.hardwareProfile.summary.totalGPUs} GPU(s)`);
          if (analysis.hardwareProfile.summary.primaryGPUType) {
            console.log(`     Primary: ${analysis.hardwareProfile.summary.primaryGPUType}`);
          }
        }

        if (analysis.hardwareProfile.servingRuntimes.length > 0) {
          const runtimes = [...new Set(analysis.hardwareProfile.servingRuntimes.map(r => r.runtime))];
          console.log(`  ✅ Serving runtimes: ${runtimes.join(', ')}`);
        }

        if (analysis.hardwareProfile.parallelization.length > 0) {
          const strategies = [...new Set(analysis.hardwareProfile.parallelization.map(p => p.strategy))];
          console.log(`  ✅ Parallelization: ${strategies.join(', ')}`);
        }
      } catch (hardwareError) {
        console.warn('  ⚠️  Hardware detection failed:', hardwareError instanceof Error ? hardwareError.message : String(hardwareError));
      }

      this.printSummary(analysis);

      return analysis;
      
    } catch (error) {
      console.error('  ❌ Codebase analysis failed:', error);
      throw error;
    }
  }

  /**
   * Validate collector configuration
   */
  async validate(): Promise<CollectorValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.scanOptions.rootPath) {
      errors.push('Root path is required');
    }

    if (!await fs.pathExists(this.scanOptions.rootPath)) {
      errors.push(`Root path does not exist: ${this.scanOptions.rootPath}`);
    }

    const stats = await fs.stat(this.scanOptions.rootPath);
    if (!stats.isDirectory()) {
      errors.push(`Root path is not a directory: ${this.scanOptions.rootPath}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      trustBoundariesRespected: true,
    };
  }

  /**
   * Load ignore patterns from .gitignore and .peakinferignore
   */
  private async loadIgnorePatterns(): Promise<ReturnType<typeof ignore>> {
    const ig = ignore();
    
    // Default ignore patterns
    const defaultPatterns = [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '.next/**',
      '__pycache__/**',
      '*.pyc',
      '.venv/**',
      'venv/**',
      '.env',
      '*.min.js',
      '*.map',
      'package-lock.json',
      'yarn.lock',
      'poetry.lock'
    ];
    
    ig.add(defaultPatterns);
    
    // Load .gitignore
    const gitignorePath = path.join(this.scanOptions.rootPath, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(content);
    }
    
    // Load .peakinferignore
    const peakinferIgnorePath = path.join(this.scanOptions.rootPath, '.peakinferignore');
    if (await fs.pathExists(peakinferIgnorePath)) {
      const content = await fs.readFile(peakinferIgnorePath, 'utf-8');
      ig.add(content);
    }
    
    // Add user-provided patterns
    if (this.scanOptions.ignorePatterns) {
      ig.add(this.scanOptions.ignorePatterns);
    }
    
    return ig;
  }

  /**
   * Find all files to scan
   */
  private async findFilesToScan(ignorePatterns: ReturnType<typeof ignore>): Promise<string[]> {
    const pattern = '**/*';
    const files = await glob(pattern, {
      cwd: this.scanOptions.rootPath,
      absolute: true,
      nodir: true,
      follow: this.scanOptions.followSymlinks || false,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    // Filter using ignore patterns
    const relativePaths = files.map(f => path.relative(this.scanOptions.rootPath, f));
    const filtered = relativePaths.filter(f => !ignorePatterns.ignores(f));
    
    // Filter by file size
    const finalFiles: string[] = [];
    for (const relPath of filtered) {
      const absPath = path.join(this.scanOptions.rootPath, relPath);
      try {
        const stats = await fs.stat(absPath);
        if (stats.size <= (this.scanOptions.maxFileSize || Infinity)) {
          finalFiles.push(absPath);
        }
      } catch (error) {
        // Skip files we can't stat
      }
    }
    
    // Limit total files
    if (this.scanOptions.maxFiles && finalFiles.length > this.scanOptions.maxFiles) {
      console.warn(`  ⚠️  Too many files (${finalFiles.length}), limiting to ${this.scanOptions.maxFiles}`);
      return finalFiles.slice(0, this.scanOptions.maxFiles);
    }
    
    return finalFiles;
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string): Promise<FileAnalysis | null> {
    const ext = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(ext);
    
    if (!language && !this.isConfigFile(filePath)) {
      return null; // Skip unsupported file types
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const analysis: FileAnalysis = {
        file: filePath,
        language: language || 'unknown',
        linesOfCode: lines.length,
        llmApiCalls: [],
        hasLLMImports: false,
        hasCaching: false,
        hasErrorHandling: false,
        errors: []
      };

      // Check for config file
      if (this.isConfigFile(filePath)) {
        analysis.configType = this.getConfigType(filePath);
      }

      // Skip analysis for non-code files
      if (!language) {
        return analysis;
      }

      // Detect LLM imports
      analysis.hasLLMImports = this.hasLLMImports(content, language);
      
      // Detect caching
      analysis.hasCaching = this.hasCaching(content);
      
      // Detect error handling
      analysis.hasErrorHandling = this.hasErrorHandling(content, language);
      
      // Find LLM API calls
      analysis.llmApiCalls = this.findLLMApiCalls(content, filePath, language);
      
      return analysis;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect programming language from extension
   */
  private detectLanguage(ext: string): string | null {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.rb': 'ruby',
      '.php': 'php',
      '.rs': 'rust',
      '.kt': 'kotlin',
      '.swift': 'swift',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
    };
    
    return languageMap[ext] || null;
  }

  /**
   * Check if file is a configuration file
   */
  private isConfigFile(filePath: string): boolean {
    const filename = path.basename(filePath);
    const configPatterns = [
      /^\.env/,
      /config\.(yaml|yml|json|toml|js|ts)$/,
      /^terraform\.tf$/,
      /docker-compose\.ya?ml$/,
      /kubernetes\.ya?ml$/,
      /package\.json$/,
      /requirements\.txt$/,
      /pyproject\.toml$/,
      /go\.mod$/,
      /Cargo\.toml$/
    ];
    
    return configPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Get config file type
   */
  private getConfigType(filePath: string): string {
    const filename = path.basename(filePath);
    const ext = path.extname(filePath);
    
    if (filename.startsWith('.env')) return 'env';
    if (filename.includes('terraform')) return 'terraform';
    if (filename.includes('docker')) return 'docker';
    if (filename.includes('kubernetes')) return 'kubernetes';
    if (ext === '.yaml' || ext === '.yml') return 'yaml';
    if (ext === '.json') return 'json';
    if (ext === '.toml') return 'toml';
    
    return 'other';
  }

  /**
   * Initialize language-specific patterns
   */
  private initializeLanguagePatterns(): LanguagePatterns[] {
    return [
      {
        language: 'javascript',
        extensions: ['.js', '.jsx'],
        llmApiPatterns: [
          {
            provider: 'openai',
            patterns: [
              /openai\.chat\.completions\.create/i,
              /openai\.completions\.create/i,
              /openai\.embeddings\.create/i,
              /new\s+OpenAI\(/i,
            ]
          },
          {
            provider: 'anthropic',
            patterns: [
              /anthropic\.messages\.create/i,
              /new\s+Anthropic\(/i,
            ]
          },
          {
            provider: 'together',
            patterns: [
              /together\.ai/i,
              /new\s+Together\(/i,
            ]
          },
          {
            provider: 'baseten',
            patterns: [
              /baseten\./i,
            ]
          },
          {
            provider: 'modal',
            patterns: [
              /modal\.app/i,
              /@modal/i,
            ]
          }
        ],
        importPatterns: [
          /import.*from\s+['"]openai['"]/i,
          /import.*from\s+['"]@anthropic-ai\/sdk['"]/i,
          /import.*from\s+['"]together-ai['"]/i,
          /require\(['"]openai['"]\)/i,
        ],
        cachePatterns: [
          /cache\./i,
          /redis/i,
          /memcached/i,
          /\.get\(/,
          /\.set\(/,
        ],
        errorHandlingPatterns: [
          /try\s*\{/,
          /catch\s*\(/,
          /\.catch\(/,
        ]
      },
      {
        language: 'typescript',
        extensions: ['.ts', '.tsx'],
        llmApiPatterns: [
          {
            provider: 'openai',
            patterns: [
              /openai\.chat\.completions\.create/i,
              /openai\.completions\.create/i,
              /openai\.embeddings\.create/i,
              /new\s+OpenAI\(/i,
            ]
          },
          {
            provider: 'anthropic',
            patterns: [
              /anthropic\.messages\.create/i,
              /new\s+Anthropic\(/i,
            ]
          },
          {
            provider: 'together',
            patterns: [
              /together\.ai/i,
              /new\s+Together\(/i,
            ]
          }
        ],
        importPatterns: [
          /import.*from\s+['"]openai['"]/i,
          /import.*from\s+['"]@anthropic-ai\/sdk['"]/i,
        ],
        cachePatterns: [
          /cache\./i,
          /redis/i,
          /memcached/i,
        ],
        errorHandlingPatterns: [
          /try\s*\{/,
          /catch\s*\(/,
        ]
      },
      {
        language: 'python',
        extensions: ['.py'],
        llmApiPatterns: [
          {
            provider: 'openai',
            patterns: [
              /openai\.chat\.completions\.create/i,
              /openai\.ChatCompletion\.create/i,
              /openai\.Completion\.create/i,
              /openai\.Embedding\.create/i,
              /OpenAI\(/i,
            ]
          },
          {
            provider: 'anthropic',
            patterns: [
              /anthropic\.messages\.create/i,
              /Anthropic\(/i,
            ]
          },
          {
            provider: 'together',
            patterns: [
              /together\.Complete\.create/i,
              /Together\(/i,
            ]
          },
          {
            provider: 'litellm',
            patterns: [
              /litellm\.completion/i,
              /litellm\.embedding/i,
            ]
          },
          {
            provider: 'langchain',
            patterns: [
              /ChatOpenAI\(/i,
              /OpenAI\(/i,
              /ChatAnthropic\(/i,
            ]
          }
        ],
        importPatterns: [
          /from\s+openai\s+import/i,
          /import\s+openai/i,
          /from\s+anthropic\s+import/i,
          /import\s+litellm/i,
        ],
        cachePatterns: [
          /cache\./i,
          /redis/i,
          /memcached/i,
          /@cache/i,
        ],
        errorHandlingPatterns: [
          /try:/,
          /except\s+/,
        ]
      },
      {
        language: 'go',
        extensions: ['.go'],
        llmApiPatterns: [
          {
            provider: 'openai',
            patterns: [
              /openai\.NewClient/i,
              /client\.CreateChatCompletion/i,
            ]
          }
        ],
        importPatterns: [
          /import\s+.*"github\.com\/openai/i,
        ],
        cachePatterns: [
          /cache\./i,
          /redis/i,
        ],
        errorHandlingPatterns: [
          /if\s+err\s*!=\s*nil/,
        ]
      }
    ];
  }

  /**
   * Check if content has LLM imports
   */
  private hasLLMImports(content: string, language: string): boolean {
    const patterns = this.languagePatterns.find(lp => lp.language === language);
    if (!patterns) return false;
    
    return patterns.importPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if content has caching
   */
  private hasCaching(content: string): boolean {
    const cacheKeywords = ['cache', 'redis', 'memcached', 'lru', 'memoize'];
    return cacheKeywords.some(keyword => content.toLowerCase().includes(keyword));
  }

  /**
   * Check if content has error handling
   */
  private hasErrorHandling(content: string, language: string): boolean {
    const patterns = this.languagePatterns.find(lp => lp.language === language);
    if (!patterns) return false;
    
    return patterns.errorHandlingPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Find LLM API calls in content
   */
  private findLLMApiCalls(content: string, filePath: string, language: string): LLMAPICall[] {
    const calls: LLMAPICall[] = [];
    const lines = content.split('\n');
    const patterns = this.languagePatterns.find(lp => lp.language === language);
    
    if (!patterns) return calls;

    for (const { provider, patterns: providerPatterns } of patterns.llmApiPatterns) {
      for (const pattern of providerPatterns) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (pattern.test(line)) {
            // Extract context (3 lines before and after)
            const contextStart = Math.max(0, i - 3);
            const contextEnd = Math.min(lines.length, i + 4);
            const context = lines.slice(contextStart, contextEnd).join('\n');
            
            // Try to detect model
            const model = this.extractModel(context, provider);
            
            calls.push({
              file: filePath,
              lineNumber: i + 1,
              lineEnd: i + 1,
              apiProvider: provider,
              model,
              callPattern: line.trim(),
              context,
              estimatedThroughput: 100, // Default tokens per second estimate
              hasCaching: this.hasCaching(context),
              hasErrorHandling: this.hasErrorHandling(context, language),
              hasRetry: /retry|attempt/i.test(context),
              language
            });
          }
        }
      }
    }

    return calls;
  }

  /**
   * Extract model name from context
   */
  private extractModel(context: string, provider: string): string | null {
    // Common model patterns
    const modelPatterns = [
      /model\s*[=:]\s*['"]([^'"]+)['"]/i,
      /model\s*[=:]\s*"([^"]+)"/i,
      /model:\s*['"]([^'"]+)['"]/i,
    ];

    for (const pattern of modelPatterns) {
      const match = context.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Identify caching opportunities
   */
  private identifyCachingOpportunities(fileAnalysis: FileAnalysis): CachingOpportunity[] {
    const opportunities: CachingOpportunity[] = [];
    
    if (fileAnalysis.llmApiCalls.length > 0 && !fileAnalysis.hasCaching) {
      // Group calls by file
      opportunities.push({
        file: fileAnalysis.file,
        lineNumber: fileAnalysis.llmApiCalls[0].lineNumber,
        recommendation: 'Add semantic caching to reduce redundant LLM calls',
        estimatedGain: fileAnalysis.llmApiCalls.length * 100 * 0.4, // 40% cache hit rate assumption - throughput gain
        implementationComplexity: 'low',
        affectedCalls: fileAnalysis.llmApiCalls.length,
        cacheType: 'semantic',
        confidence: 0.8
      });
    }

    return opportunities;
  }

  /**
   * Identify code optimizations
   */
  private identifyOptimizations(fileAnalysis: FileAnalysis): CodeOptimization[] {
    const optimizations: CodeOptimization[] = [];

    // Missing error handling
    const callsWithoutErrorHandling = fileAnalysis.llmApiCalls.filter(call => !call.hasErrorHandling);
    if (callsWithoutErrorHandling.length > 0) {
      for (const call of callsWithoutErrorHandling) {
        optimizations.push({
          file: fileAnalysis.file,
          lineNumber: call.lineNumber,
          type: 'error-handling',
          description: 'Add error handling for LLM API call',
          currentCode: call.callPattern,
          estimatedGain: 100, // Throughput improvement from avoiding unhandled errors
          implementationEffort: 'low',
          priority: 'medium'
        });
      }
    }

    // Missing caching
    if (fileAnalysis.llmApiCalls.length > 0 && !fileAnalysis.hasCaching) {
      optimizations.push({
        file: fileAnalysis.file,
        lineNumber: fileAnalysis.llmApiCalls[0].lineNumber,
        type: 'caching',
        description: 'Implement caching layer for LLM calls',
        currentCode: 'No caching detected',
        estimatedGain: fileAnalysis.llmApiCalls.length * 50,
        implementationEffort: 'medium',
        priority: 'high',
        templateId: 'semantic-caching-optimization'
      });
    }

    return optimizations;
  }

  /**
   * Detect integration points
   */
  private detectIntegrationPoints(fileAnalysis: FileAnalysis): IntegrationPoint[] {
    const points: IntegrationPoint[] = [];
    
    // Read file content again for integration detection
    // This is a simplified version - could be enhanced
    
    return points;
  }

  /**
   * Analyze config file
   */
  private async analyzeConfigFile(filePath: string, configType: string): Promise<ConfigFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    const config: ConfigFile = {
      file: filePath,
      type: configType as any,
      hasLLMConfig: false,
      hasApiKeys: false,
    };

    // Check for LLM-related config
    const llmKeywords = ['openai', 'anthropic', 'together', 'api_key', 'model', 'llm'];
    config.hasLLMConfig = llmKeywords.some(keyword => content.toLowerCase().includes(keyword));

    // Check for API keys (but don't expose them)
    config.hasApiKeys = /api[_-]?key/i.test(content) || /sk-[a-zA-Z0-9]{20,}/i.test(content);

    // Sanitize content (remove sensitive data)
    config.sanitizedContent = this.sanitizeConfig(content);

    return config;
  }

  /**
   * Sanitize config content
   */
  private sanitizeConfig(content: string): string {
    // Remove API keys and sensitive data
    let sanitized = content;
    
    // Remove common API key patterns
    sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***');
    sanitized = sanitized.replace(/api[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi, 'api_key=***REDACTED***');
    sanitized = sanitized.replace(/token\s*[=:]\s*['"][^'"]+['"]/gi, 'token=***REDACTED***');
    sanitized = sanitized.replace(/password\s*[=:]\s*['"][^'"]+['"]/gi, 'password=***REDACTED***');
    
    return sanitized;
  }

  /**
   * Aggregate model usage patterns
   */
  private aggregateModelUsage(calls: LLMAPICall[]): ModelUsagePattern[] {
    const usageMap = new Map<string, ModelUsagePattern>();

    for (const call of calls) {
      const key = `${call.apiProvider}-${call.model || 'unknown'}`;
      
      if (!usageMap.has(key)) {
        usageMap.set(key, {
          model: call.model || 'unknown',
          provider: call.apiProvider,
          occurrences: 0,
          files: [],
          estimatedMonthlyThroughput: 0,
          averageContextLength: 0,
          usageType: 'unknown'
        });
      }

      const pattern = usageMap.get(key)!;
      pattern.occurrences++;
      if (!pattern.files.includes(call.file)) {
        pattern.files.push(call.file);
      }
      pattern.estimatedMonthlyThroughput += call.estimatedThroughput * 1000; // Assume 1000 calls/month per location
    }

    return Array.from(usageMap.values());
  }

  /**
   * Print analysis summary
   */
  private printSummary(analysis: CodebaseAnalysis): void {
    console.log('\n📊 Codebase Analysis Summary:\n');
    console.log(`  📁 Files Scanned: ${analysis.codeMetrics.totalFiles}`);
    console.log(`  📝 Lines of Code: ${analysis.codeMetrics.totalLinesScanned.toLocaleString()}`);
    console.log(`  🔍 Files with LLM Calls: ${analysis.codeMetrics.filesWithLLMCalls}`);
    console.log(`  🤖 Total LLM API Calls Found: ${analysis.codeMetrics.totalLLMCalls}`);
    console.log(`  💾 Caching Opportunities: ${analysis.cachingOpportunities.length}`);
    console.log(`  ⚡ Optimization Opportunities: ${analysis.optimizationOpportunities.length}`);
    console.log(`  ⚙️  Configuration Files: ${analysis.configurationFiles.length}`);
    console.log(`  ⏱️  Scan Duration: ${(analysis.codeMetrics.scanDurationMs / 1000).toFixed(2)}s`);
    
    if (Object.keys(analysis.codeMetrics.providerDistribution).length > 0) {
      console.log('\n  Provider Distribution:');
      for (const [provider, count] of Object.entries(analysis.codeMetrics.providerDistribution)) {
        console.log(`    • ${provider}: ${count} calls`);
      }
    }
    
    console.log('');
  }
}

