import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Local filesystem object storage under STORAGE_ROOT (default ./.data/storage).
 */
export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
};

export type SignedUrlInput = {
  key: string;
  expiresInSeconds?: number;
};

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  getObject(key: string): Promise<Buffer>;
  getSignedDownloadUrl(input: SignedUrlInput): Promise<string>;
}

export function storageRoot(): string {
  return process.env.STORAGE_ROOT ?? path.resolve(process.cwd(), '.data/storage');
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly root = storageRoot()) {}

  private resolveKey(key: string) {
    const normalized = key.replace(/^\/+/, '').replace(/\.\./g, '');
    return path.join(this.root, normalized);
  }

  async putObject(input: PutObjectInput) {
    const fullPath = this.resolveKey(input.key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.body);
    return { key: input.key };
  }

  async getObject(key: string) {
    return readFile(this.resolveKey(key));
  }

  async getSignedDownloadUrl(input: SignedUrlInput) {
    // Downloads go through authenticated API; URL is an internal locator.
    return `local://${input.key}?expires=${input.expiresInSeconds ?? 300}`;
  }
}

export function checksumOf(body: Buffer | Uint8Array): string {
  return createHash('sha256').update(body).digest('hex');
}