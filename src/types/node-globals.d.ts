declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

declare module "node:crypto" {
  export function randomUUID(): string;
}

declare module "node:fs/promises" {
  export function access(path: string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function readFile(path: string, encoding: string): Promise<string>;
  export function writeFile(path: string, data: string, encoding?: string): Promise<void>;
}

declare module "node:path" {
  export function basename(path: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:child_process" {
  export const execFile: (...args: any[]) => any;
}

declare module "node:util" {
  export function promisify(fn: (...args: any[]) => any): (...args: any[]) => Promise<any>;
}
