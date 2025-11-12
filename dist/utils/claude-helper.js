/**
 * Claude Helper Utilities
 * Manages Claude API key and formats responses beautifully
 */
import chalk from 'chalk';
import * as readline from 'readline';
export class ClaudeHelper {
    /**
     * Check if Claude API key is available
     */
    static checkApiKey() {
        const key = process.env.ANTHROPIC_API_KEY;
        return !!key && key.length > 0;
    }
    /**
     * Get API key from environment
     */
    static getApiKey() {
        return process.env.ANTHROPIC_API_KEY;
    }
    /**
     * Prompt user for API key if not found
     */
    static async promptForApiKey() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            console.log(chalk.yellow('\n⚠️  Claude API Key Required\n'));
            console.log(chalk.gray('TokenOp uses Claude Code SDK for intelligent optimization.'));
            console.log(chalk.gray('Get your API key from: https://console.anthropic.com/\n'));
            rl.question(chalk.cyan('Enter your Anthropic API key: '), (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }
    /**
     * Validate API key format
     */
    static validateApiKey(key) {
        // Anthropic keys start with sk-ant-
        return key.startsWith('sk-ant-') && key.length > 20;
    }
    /**
     * Ensure API key is available (check env or prompt)
     */
    static async ensureApiKey() {
        if (this.checkApiKey()) {
            console.log(chalk.green('✓ Claude API key found\n'));
            return;
        }
        console.log(chalk.yellow('⚠️  No Claude API key found in environment\n'));
        console.log(chalk.gray('You can set it by running:'));
        console.log(chalk.gray('  export ANTHROPIC_API_KEY="sk-ant-..."'));
        console.log(chalk.gray('Or provide it now:\n'));
        const key = await this.promptForApiKey();
        if (!key) {
            console.error(chalk.red('\n❌ API key is required to run TokenOp'));
            console.log(chalk.gray('Get your key from: https://console.anthropic.com/\n'));
            process.exit(1);
        }
        if (!this.validateApiKey(key)) {
            console.error(chalk.red('\n❌ Invalid API key format'));
            console.log(chalk.gray('Anthropic API keys should start with "sk-ant-"\n'));
            process.exit(1);
        }
        // Set for current session
        process.env.ANTHROPIC_API_KEY = key;
        console.log(chalk.green('\n✓ API key validated successfully\n'));
    }
    /**
     * Format Claude's analysis response beautifully
     */
    static formatAnalysis(title, analysis) {
        console.log(chalk.blue.bold(`\n${'═'.repeat(60)}`));
        console.log(chalk.blue.bold(`  🤖 Claude Analysis: ${title}`));
        console.log(chalk.blue.bold(`${'═'.repeat(60)}\n`));
        if (analysis.problems && analysis.problems.length > 0) {
            console.log(chalk.red.bold('🔴 Problems Identified:\n'));
            analysis.problems.forEach((problem, i) => {
                console.log(chalk.red(`  ${i + 1}. ${problem}`));
            });
            console.log('');
        }
        if (analysis.findings && analysis.findings.length > 0) {
            console.log(chalk.yellow.bold('🔍 Key Findings:\n'));
            analysis.findings.forEach((finding, i) => {
                console.log(chalk.yellow(`  ${i + 1}. ${finding}`));
            });
            console.log('');
        }
        if (analysis.solutions && analysis.solutions.length > 0) {
            console.log(chalk.green.bold('✅ Suggested Solutions:\n'));
            analysis.solutions.forEach((solution, i) => {
                console.log(chalk.green.bold(`  ${i + 1}. ${solution.title || 'Solution'}`));
                console.log(chalk.gray(`     ${solution.description || solution}`));
                if (solution.savings) {
                    console.log(chalk.cyan(`     💰 Potential Savings: $${solution.savings}/month`));
                }
                if (solution.effort) {
                    console.log(chalk.magenta(`     🔧 Effort: ${solution.effort}`));
                }
                console.log('');
            });
        }
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            console.log(chalk.cyan.bold('💡 Recommendations:\n'));
            analysis.recommendations.forEach((rec, i) => {
                console.log(chalk.cyan(`  • ${rec}`));
            });
            console.log('');
        }
        console.log(chalk.blue.bold(`${'═'.repeat(60)}\n`));
    }
    /**
     * Format problem/solution pair
     */
    static formatProblemSolution(problem, solution, details) {
        console.log(chalk.red.bold('\n📌 Problem Detected:'));
        console.log(chalk.red(`  ${problem}\n`));
        console.log(chalk.green.bold('✨ Suggested Solution:'));
        console.log(chalk.green(`  ${solution}\n`));
        if (details) {
            if (details.cost_impact) {
                console.log(chalk.cyan(`💰 Cost Impact: ${details.cost_impact}`));
            }
            if (details.implementation_time) {
                console.log(chalk.magenta(`⏱️  Implementation Time: ${details.implementation_time}`));
            }
            if (details.complexity) {
                console.log(chalk.yellow(`🔧 Complexity: ${details.complexity}`));
            }
            if (details.risks) {
                console.log(chalk.red(`⚠️  Risks: ${details.risks}`));
            }
            console.log('');
        }
    }
    /**
     * Show Claude thinking process
     */
    static showThinking(message) {
        console.log(chalk.gray(`  💭 Claude: ${message}`));
    }
    /**
     * Show Claude's final recommendation
     */
    static showRecommendation(title, description, priority = 'medium') {
        const colors = {
            high: chalk.red,
            medium: chalk.yellow,
            low: chalk.green
        };
        const icons = {
            high: '🔴',
            medium: '🟡',
            low: '🟢'
        };
        console.log(colors[priority].bold(`\n${icons[priority]} ${title}`));
        console.log(chalk.gray(`  ${description}\n`));
    }
    /**
     * Format optimization opportunity
     */
    static formatOptimization(optimization) {
        console.log(chalk.blue.bold(`\n╔${'═'.repeat(58)}╗`));
        console.log(chalk.blue.bold(`║  ${optimization.name.padEnd(55)} ║`));
        console.log(chalk.blue.bold(`╚${'═'.repeat(58)}╝\n`));
        console.log(chalk.white.bold('📝 Description:'));
        console.log(chalk.gray(`   ${optimization.description}\n`));
        console.log(chalk.red.bold('❌ Current State:'));
        console.log(chalk.red(`   ${optimization.current_state}\n`));
        console.log(chalk.green.bold('✅ Proposed State:'));
        console.log(chalk.green(`   ${optimization.proposed_state}\n`));
        console.log(chalk.cyan.bold('💰 Economic Impact:'));
        console.log(chalk.cyan(`   Monthly Savings: $${optimization.savings_monthly.toLocaleString()}`));
        console.log(chalk.cyan(`   Annual Savings: $${(optimization.savings_monthly * 12).toLocaleString()}\n`));
        console.log(chalk.magenta.bold('🔧 Implementation:'));
        console.log(chalk.magenta(`   Effort: ${optimization.implementation_effort}`));
        console.log(chalk.magenta(`   Confidence: ${(optimization.confidence * 100).toFixed(1)}%\n`));
    }
}
