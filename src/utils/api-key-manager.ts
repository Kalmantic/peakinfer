/**
 * API Key Manager
 * Handles Anthropic API key configuration and validation
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

export class APIKeyManager {
  private configDir: string;
  private configFile: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.peakinfer');
    this.configFile = path.join(this.configDir, 'config.json');
  }

  /**
   * Get API key from environment or config
   */
  async getAPIKey(): Promise<string | null> {
    // Check environment variable first
    if (process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY;
    }

    // Check config file
    if (await fs.pathExists(this.configFile)) {
      const config = await fs.readJson(this.configFile);
      return config.anthropic_api_key || null;
    }

    return null;
  }

  /**
   * Prompt user for API key and save it
   */
  async promptAndSaveAPIKey(): Promise<string> {
    console.log('\n🔑 Anthropic API Key Required');
    console.log('PeakInfer uses Claude to analyze and optimize your LLM infrastructure.');
    console.log('You can get your API key from: https://console.anthropic.com/settings/keys\n');

    const apiKey = await this.promptForKey();

    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key is required to use PeakInfer');
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-ant-')) {
      console.warn('⚠️  Warning: API key format looks unusual (expected to start with "sk-ant-")');
      console.warn('Proceeding anyway, but the key might be invalid.\n');
    }

    // Save to config
    await this.saveAPIKey(apiKey);

    console.log('✅ API key saved successfully!\n');

    // Make key immediately available to current process
    process.env.ANTHROPIC_API_KEY = apiKey;

    return apiKey;
  }

  /**
   * Prompt user for API key input
   */
  private async promptForKey(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('Enter your Anthropic API key: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Save API key to config file
   */
  private async saveAPIKey(apiKey: string): Promise<void> {
    // Ensure config directory exists
    await fs.ensureDir(this.configDir);

    // Load existing config or create new
    let config: any = {};
    if (await fs.pathExists(this.configFile)) {
      config = await fs.readJson(this.configFile);
    }

    // Update API key
    config.anthropic_api_key = apiKey;
    config.updated_at = new Date().toISOString();

    // Save config
    await fs.writeJson(this.configFile, config, { spaces: 2 });

    // Set restrictive permissions on config file
    try {
      await fs.chmod(this.configFile, 0o600); // Read/write for owner only
    } catch (error) {
      // Ignore chmod errors on Windows
    }
  }

  /**
   * Ensure API key is available
   */
  async ensureAPIKey(): Promise<string> {
    let apiKey = await this.getAPIKey();

    if (!apiKey) {
      apiKey = await this.promptAndSaveAPIKey();
    } else if (!process.env.ANTHROPIC_API_KEY) {
      // Ensure downstream imports can access the key just like a normal env var
      process.env.ANTHROPIC_API_KEY = apiKey;
    }

    return apiKey;
  }

  /**
   * Check if API key is configured
   */
  async hasAPIKey(): Promise<boolean> {
    const apiKey = await this.getAPIKey();
    return apiKey !== null && apiKey.length > 0;
  }

  /**
   * Clear saved API key
   */
  async clearAPIKey(): Promise<void> {
    if (await fs.pathExists(this.configFile)) {
      const config = await fs.readJson(this.configFile);
      delete config.anthropic_api_key;
      await fs.writeJson(this.configFile, config, { spaces: 2 });
      console.log('✅ API key cleared from config');
    }
  }

  /**
   * Get config file path for display
   */
  getConfigPath(): string {
    return this.configFile;
  }
}

