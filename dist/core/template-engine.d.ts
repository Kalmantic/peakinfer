/**
 * Template Engine - Loads and executes optimization templates
 * This is the core system that turns TokenSqueeze insights into actionable optimizations
 */
import { OptimizationTemplate, EnvironmentProfile } from '../types/template.js';
export declare class TemplateEngine {
    private templatesDirectory?;
    private templates;
    private templatesLoaded;
    constructor(templatesDirectory?: string | undefined);
    /**
     * Stage 1: Configuration ⏳
     * Load all optimization templates from the design folder
     */
    loadTemplates(): Promise<void>;
    /**
     * Extract templates from the main design document
     * Parses the PeakInfer Template v0.2.md file to extract YAML templates
     */
    private extractTemplatesFromDesignDoc;
    /**
     * Extract YAML blocks from markdown content
     */
    private extractYamlFromMarkdown;
    /**
     * Load standalone template files (if any exist)
     */
    private loadStandaloneTemplateFiles;
    /**
     * Stage 2: Template Matching ⏳
     * Find templates that match the detected environment
     */
    findMatchingTemplates(environment: EnvironmentProfile): Promise<OptimizationTemplate[]>;
    /**
     * Calculate how well a template matches the environment
     * Returns score 0-1 (higher = better match)
     */
    private calculateMatchScore;
    /**
     * Check if a value matches a range specification
     * Range can be like "<30%", ">1000", "7B-30B", etc.
     */
    private matchesRange;
    /**
     * Get template by ID
     */
    getTemplate(templateId: string): OptimizationTemplate | undefined;
    /**
     * List all available templates
     */
    listTemplates(): OptimizationTemplate[];
    /**
     * Get templates by category
     */
    getTemplatesByCategory(category: string): OptimizationTemplate[];
    /**
     * Find templates directory
     */
    private findTemplatesDirectory;
    /**
     * Validate template format
     */
    validateTemplate(template: OptimizationTemplate): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Load templates from GitHub repository
     */
    private loadTemplatesFromGitHub;
    /**
     * Fetch content from GitHub using HTTPS
     */
    private fetchFromGitHub;
}
