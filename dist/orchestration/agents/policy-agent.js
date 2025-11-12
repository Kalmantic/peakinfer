/**
 * Policy Agent
 * Loads and enforces organizational constraints and policies
 */
import * as fs from 'fs-extra';
import * as yaml from 'yaml';
export class PolicyAgent {
    /**
     * Load optimization policy from file or use defaults
     */
    async loadPolicy(policyPath) {
        console.log('  📋 Loading optimization policy...\n');
        // Try to load from file
        if (policyPath) {
            const policy = await this.loadPolicyFromFile(policyPath);
            if (policy) {
                console.log('  ✓ Policy loaded from:', policyPath);
                this.logPolicy(policy);
                return policy;
            }
        }
        // Look for default policy files
        const defaultPaths = [
            'policy.yaml',
            'policy.yml',
            'tokenop-policy.yaml',
            '.tokenop/policy.yaml',
            'config/policy.yaml'
        ];
        for (const defaultPath of defaultPaths) {
            if (await fs.pathExists(defaultPath)) {
                const policy = await this.loadPolicyFromFile(defaultPath);
                if (policy) {
                    console.log('  ✓ Policy loaded from:', defaultPath);
                    this.logPolicy(policy);
                    return policy;
                }
            }
        }
        // Use default policy
        console.log('  ℹ️  No policy file found, using default policy');
        const policy = this.getDefaultPolicy();
        this.logPolicy(policy);
        return policy;
    }
    /**
     * Load policy from YAML file
     */
    async loadPolicyFromFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = yaml.parse(content);
            return {
                quality_threshold: parsed.quality_threshold || 0.95,
                latency_sla_ms: parsed.latency_sla_ms || 1000,
                budget_monthly: parsed.budget_monthly || 50000,
                allowed_risk_levels: parsed.allowed_risk_levels || ['low', 'medium'],
                required_approvals: parsed.required_approvals || [],
                excluded_techniques: parsed.excluded_techniques || []
            };
        }
        catch (error) {
            console.warn('  ⚠️  Failed to load policy from file:', error instanceof Error ? error.message : String(error));
            return null;
        }
    }
    /**
     * Get default policy
     */
    getDefaultPolicy() {
        return {
            quality_threshold: 0.95, // 95% minimum quality preservation
            latency_sla_ms: 1000, // 1 second SLA
            budget_monthly: 50000, // $50k monthly budget
            allowed_risk_levels: ['low', 'medium'], // No high-risk optimizations without approval
            required_approvals: [], // No approvals required for low/medium risk
            excluded_techniques: [] // No techniques excluded by default
        };
    }
    /**
     * Log policy details
     */
    logPolicy(policy) {
        console.log('  ┌─ Policy Configuration');
        console.log(`  │  Quality Threshold: ${(policy.quality_threshold * 100).toFixed(0)}%`);
        console.log(`  │  Latency SLA: ${policy.latency_sla_ms}ms`);
        console.log(`  │  Monthly Budget: $${policy.budget_monthly.toLocaleString()}`);
        console.log(`  │  Allowed Risk: ${policy.allowed_risk_levels.join(', ')}`);
        if (policy.excluded_techniques.length > 0) {
            console.log(`  │  Excluded: ${policy.excluded_techniques.join(', ')}`);
        }
        console.log('  └─');
    }
    /**
     * Validate if template meets policy constraints
     */
    validateTemplate(template, policy) {
        // Check risk level
        if (!policy.allowed_risk_levels.includes(template.optimization?.risk_level || 'low')) {
            return {
                allowed: false,
                reason: `Risk level '${template.optimization?.risk_level}' not allowed by policy`,
                requires_approval: true
            };
        }
        // Check excluded techniques
        if (policy.excluded_techniques.includes(template.optimization?.technique)) {
            return {
                allowed: false,
                reason: `Technique '${template.optimization?.technique}' is excluded by policy`,
                requires_approval: false
            };
        }
        // Check if requires approval
        const requiresApproval = template.optimization?.risk_level === 'high' &&
            policy.required_approvals.length > 0;
        return {
            allowed: true,
            requires_approval: requiresApproval
        };
    }
}
