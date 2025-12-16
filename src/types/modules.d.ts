/**
 * Type declarations for modules without types
 */

// fs-extra module (extends fs with promise-based methods)
declare module 'fs-extra' {
  import * as fs from 'fs';
  
  export function ensureDir(path: string): Promise<void>;
  export function ensureDirSync(path: string): void;
  export function remove(path: string): Promise<void>;
  export function removeSync(path: string): void;
  export function copy(src: string, dest: string, options?: { overwrite?: boolean }): Promise<void>;
  export function copySync(src: string, dest: string, options?: { overwrite?: boolean }): void;
  export function move(src: string, dest: string, options?: { overwrite?: boolean }): Promise<void>;
  export function moveSync(src: string, dest: string, options?: { overwrite?: boolean }): void;
  export function readJson(file: string): Promise<unknown>;
  export function readJsonSync(file: string): unknown;
  export function writeJson(file: string, object: unknown, options?: { spaces?: number }): Promise<void>;
  export function writeJsonSync(file: string, object: unknown, options?: { spaces?: number }): void;
  export function outputFile(file: string, data: string | Buffer): Promise<void>;
  export function outputFileSync(file: string, data: string | Buffer): void;
  export function outputJson(file: string, data: unknown, options?: { spaces?: number }): Promise<void>;
  export function outputJsonSync(file: string, data: unknown, options?: { spaces?: number }): void;
  export function pathExists(path: string): Promise<boolean>;
  export function pathExistsSync(path: string): boolean;
  export function emptyDir(path: string): Promise<void>;
  export function emptyDirSync(path: string): void;
  
  // Re-export fs types
  export const existsSync: typeof fs.existsSync;
  export const readFileSync: typeof fs.readFileSync;
  export const writeFileSync: typeof fs.writeFileSync;
  export const mkdirSync: typeof fs.mkdirSync;
  export const readdirSync: typeof fs.readdirSync;
  export const statSync: typeof fs.statSync;
  export const unlinkSync: typeof fs.unlinkSync;
  export const rmdirSync: typeof fs.rmdirSync;
  export const copyFileSync: typeof fs.copyFileSync;
  export const renameSync: typeof fs.renameSync;
  export const chmodSync: typeof fs.chmodSync;
  export function readFile(path: string, encoding: BufferEncoding): Promise<string>;
  export function readFile(path: string, options?: { encoding?: BufferEncoding | null }): Promise<string | Buffer>;
  export function writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  export function writeFile(path: string, data: string | Buffer, options?: { encoding?: BufferEncoding }): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function readdir(path: string): Promise<string[]>;
  export function stat(path: string): Promise<fs.Stats>;
  export function unlink(path: string): Promise<void>;
  export function rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function copyFile(src: string, dest: string): Promise<void>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function chmod(path: string, mode: fs.Mode): Promise<void>;
  
  const fsExtra: {
    ensureDir: typeof ensureDir;
    ensureDirSync: typeof ensureDirSync;
    remove: typeof remove;
    removeSync: typeof removeSync;
    copy: typeof copy;
    copySync: typeof copySync;
    move: typeof move;
    moveSync: typeof moveSync;
    readJson: typeof readJson;
    readJsonSync: typeof readJsonSync;
    writeJson: typeof writeJson;
    writeJsonSync: typeof writeJsonSync;
    outputFile: typeof outputFile;
    outputFileSync: typeof outputFileSync;
    outputJson: typeof outputJson;
    outputJsonSync: typeof outputJsonSync;
    pathExists: typeof pathExists;
    pathExistsSync: typeof pathExistsSync;
    emptyDir: typeof emptyDir;
    emptyDirSync: typeof emptyDirSync;
    existsSync: typeof existsSync;
    readFileSync: typeof readFileSync;
    writeFileSync: typeof writeFileSync;
    mkdirSync: typeof mkdirSync;
    readdirSync: typeof readdirSync;
    statSync: typeof statSync;
    unlinkSync: typeof unlinkSync;
    rmdirSync: typeof rmdirSync;
    copyFileSync: typeof copyFileSync;
    renameSync: typeof renameSync;
    chmodSync: typeof chmodSync;
    readFile: typeof readFile;
    writeFile: typeof writeFile;
    mkdir: typeof mkdir;
    readdir: typeof readdir;
    stat: typeof stat;
    unlink: typeof unlink;
    rmdir: typeof rmdir;
    copyFile: typeof copyFile;
    rename: typeof rename;
    chmod: typeof chmod;
  };
  
  export default fsExtra;
}

// uuid module
declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v3(name: string, namespace: string): string;
  export function v5(name: string, namespace: string): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
  export function parse(uuid: string): Uint8Array;
  export function stringify(arr: Uint8Array): string;
  export const NIL: string;
}

// jsonrepair module
declare module 'jsonrepair' {
  export function jsonrepair(json: string): string;
}

// Claude Agent SDK (if not available)
declare module '@anthropic-ai/claude-agent-sdk' {
  export interface SDKMessage {
    type: 'assistant' | 'user' | 'result';
    message?: {
      content: Array<{
        type: string;
        name?: string;
        input?: unknown;
        text?: string;
      }>;
    };
    subtype?: 'success' | 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd';
    result?: string;
    errors?: string[];
    total_cost_usd?: number;
  }

  export interface SDKResultMessage extends SDKMessage {
    type: 'result';
    subtype: 'success' | 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd';
    result: string;
    total_cost_usd: number;
  }

  export interface QueryOptions {
    prompt: string;
    options: {
      cwd: string;
      allowedTools: string[];
      permissionMode: 'bypassPermissions' | 'askPermissions';
      maxTurns?: number;
      abortController?: AbortController;
      model?: string;
      env?: Record<string, string | undefined>;
    };
  }

  export function query(options: QueryOptions): AsyncGenerator<SDKMessage>;
}

// hcl2-json-parser module
declare module 'hcl2-json-parser' {
  export function parseToObject(hcl: string): Promise<Record<string, unknown>>;
}

// ignore module augmentation to help with types
declare module 'ignore' {
  interface Ignore {
    add(patterns: string | readonly string[]): Ignore;
    filter(paths: readonly string[]): string[];
    ignores(pathname: string): boolean;
    createFilter(): (pathname: string) => boolean;
  }
  
  function ignore(): Ignore;
  export = ignore;
}
