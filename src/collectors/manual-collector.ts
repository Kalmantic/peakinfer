/**
 * Manual Collector - File-based Implementation
 * Loads inference events from JSONL, CSV, or Parquet files
 * Based on PRD v0.7: Manual input for demos/OSS users
 */

import { BaseCollector } from './base-collector.js';
import { InferenceEvent } from '../types/events.js';
import { CollectorValidationResult, ManualCollectorConfig } from '../types/collectors.js';
import fs from 'fs-extra';
import * as path from 'path';

export class ManualCollector extends BaseCollector {
  private mockConfig: ManualCollectorConfig;

  constructor(config: ManualCollectorConfig) {
    super('manual', config);
    this.mockConfig = config;
  }

  /**
   * Collect events from manual input files
   */
  async collect(): Promise<InferenceEvent[]> {
    console.log('  📁 Loading inference events from files...');
    
    this.respectTrustBoundaries();
    
    const allEvents: InferenceEvent[] = [];
    
    for (const file of this.mockConfig.input.files) {
      try {
        const events = await this.loadFile(file);
        allEvents.push(...events);
        console.log(`  ✅ Loaded ${events.length} events from ${path.basename(file)}`);
      } catch (error) {
        console.error(`  ❌ Failed to load ${file}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    console.log(`  ✅ Total: ${allEvents.length} inference events loaded`);
    return allEvents;
  }

  /**
   * Validate manual collector configuration
   */
  async validate(): Promise<CollectorValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.mockConfig.input?.files || this.mockConfig.input.files.length === 0) {
      errors.push('No input files specified');
      return {
        valid: false,
        errors,
        warnings,
        trustBoundariesRespected: true,
      };
    }

    // Validate each file exists and is readable
    for (const file of this.mockConfig.input.files) {
      if (!await fs.pathExists(file)) {
        errors.push(`File not found: ${file}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      trustBoundariesRespected: true,
    };
  }

  /**
   * Load events from a file based on format
   */
  private async loadFile(filePath: string): Promise<InferenceEvent[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.jsonl':
        return this.loadJSONL(filePath);
      case '.json':
        return this.loadJSON(filePath);
      case '.csv':
        return this.loadCSV(filePath);
      case '.parquet':
        return this.loadParquet(filePath);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  /**
   * Load JSONL file (newline-delimited JSON)
   */
  private async loadJSONL(filePath: string): Promise<InferenceEvent[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const events: InferenceEvent[] = [];
    
    for (const line of lines) {
      try {
        const raw = JSON.parse(line);
        const event = this.normalizeRawEvent(raw);
        events.push(this.filterPII(event));
      } catch (error) {
        console.warn(`  ⚠️  Failed to parse line in ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    return events;
  }

  /**
   * Load JSON file (array of events)
   */
  private async loadJSON(filePath: string): Promise<InferenceEvent[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Handle both single event and array of events
    const rawEvents = Array.isArray(data) ? data : [data];
    
    return rawEvents
      .map(raw => this.normalizeRawEvent(raw))
      .map(event => this.filterPII(event));
  }

  /**
   * Load CSV file
   */
  private async loadCSV(filePath: string): Promise<InferenceEvent[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file must have header and at least one data row');
    }
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Parse data rows
    const events: InferenceEvent[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length !== headers.length) {
        console.warn(`  ⚠️  Skipping malformed CSV row ${i + 1}`);
        continue;
      }
      
      // Create object from headers and values
      const raw: any = {};
      for (let j = 0; j < headers.length; j++) {
        raw[headers[j]] = values[j];
      }
      
      try {
        const event = this.normalizeRawEvent(raw);
        events.push(this.filterPII(event));
      } catch (error) {
        console.warn(`  ⚠️  Failed to normalize CSV row ${i + 1}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    return events;
  }

  /**
   * Load Parquet file
   * Note: Requires parquet library - for now, return mock data
   */
  private async loadParquet(filePath: string): Promise<InferenceEvent[]> {
    // In real implementation, would use a parquet library like 'parquetjs'
    // For now, throw informative error
    throw new Error(
      'Parquet support not yet implemented. Please convert to JSONL or CSV format.\n' +
      'You can use: parquet-tools cat --json <file.parquet> > events.jsonl'
    );
  }

  /**
   * Normalize raw event from file
   */
  private normalizeRawEvent(raw: any): InferenceEvent {
    // If already in canonical format, use as-is
    if (this.isCanonicalEvent(raw)) {
      return raw as InferenceEvent;
    }
    
    // Otherwise, use base normalizer with detected provider
    const provider = raw.provider || raw.model_provider || this.detectProvider(raw);
    return this.normalizeEvent(raw, provider);
  }

  /**
   * Check if event is already in canonical format
   */
  private isCanonicalEvent(raw: any): boolean {
    return (
      raw.id &&
      raw.ts &&
      raw.provider &&
      raw.model &&
      raw.input_tokens !== undefined &&
      raw.output_tokens !== undefined &&
      raw.cost_usd !== undefined
    );
  }

  /**
   * Detect provider from raw event
   */
  private detectProvider(raw: any): string {
    const model = raw.model || raw.model_name || '';
    
    if (model.includes('gpt')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('llama') || model.includes('mixtral')) return 'together';
    if (raw.endpoint?.includes('openai')) return 'openai';
    if (raw.endpoint?.includes('anthropic')) return 'anthropic';
    if (raw.endpoint?.includes('together')) return 'together';
    if (raw.endpoint?.includes('baseten')) return 'baseten';
    
    return 'unknown';
  }
}

