declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

declare const Buffer: {
  from(data: string, encoding?: string): Uint8Array;
};

declare module "node:crypto" {
  export function randomUUID(): string;
}

declare module "node:fs/promises" {
  export function access(path: string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function readFile(path: string, encoding: string): Promise<string>;
  export function writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void>;
}

declare module "node:path" {
  export function basename(path: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:http" {
  export type IncomingMessage = {
    method?: string;
    url?: string;
    on(event: "data", callback: (chunk: Uint8Array) => void): void;
    on(event: "end", callback: () => void): void;
    on(event: "error", callback: (error: Error) => void): void;
  };

  export type ServerResponse = {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(data?: string | Uint8Array): void;
  };

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void,
  ): {
    listen(port: number, callback?: () => void): void;
  };
}

declare module "node:child_process" {
  export const execFile: (...args: any[]) => any;
}

declare module "node:util" {
  export function promisify(fn: (...args: any[]) => any): (...args: any[]) => Promise<any>;
}
