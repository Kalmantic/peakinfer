/**
 * Single source of truth for version
 * Auto-bumped on each build via npm version patch
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Read version from package.json at runtime
function getPackageVersion(): string {
  try {
    // Handle both development (src/) and production (dist/) paths
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packagePath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export const VERSION = getPackageVersion();
export const VERSION_DISPLAY = `PeakInfer v${VERSION}`;
