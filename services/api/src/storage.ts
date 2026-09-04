import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

/**
 * Every document read/write in the system goes through this interface.
 * Callers never see a raw storage path or credential — only a key (opaque
 * outside this module) and, when they need to hand a URL to a client, a
 * short-lived signed one. Swapping STORAGE_DRIVER to a Supabase/R2-backed
 * provider later changes nothing outside this file.
 */
export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export class LocalDiskStorageProvider implements StorageProvider {
  constructor(
    private readonly root: string,
    private readonly apiBaseUrl: string,
  ) {}

  private resolve(key: string): string {
    const safeKey = key.replace(/\.\./g, "");
    return path.join(this.root, safeKey);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  /**
   * Local dev has no real object-storage CDN to hand out a presigned URL
   * for, so we sign a callback into our own API instead. A cloud-backed
   * provider (Supabase/R2) would instead return that provider's own native
   * presigned URL here and skip our verification route entirely.
   */
  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const signature = signLocalStorageToken(key, expiresAt);
    const params = new URLSearchParams({
      key,
      exp: String(expiresAt),
      sig: signature,
    });
    return `${this.apiBaseUrl}/storage/local?${params.toString()}`;
  }
}

export function signLocalStorageToken(key: string, expiresAt: number): string {
  return createHmac("sha256", config.storageSigningSecret)
    .update(`${key}:${expiresAt}`)
    .digest("hex");
}

export function verifyLocalStorageToken(
  key: string,
  expiresAt: number,
  signature: string,
): boolean {
  if (Date.now() > expiresAt) return false;
  const expected = signLocalStorageToken(key, expiresAt);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;
  if (config.storageDriver !== "local") {
    throw new Error(
      `Storage driver "${config.storageDriver}" isn't implemented yet — only "local" is wired up in this vertical slice.`,
    );
  }
  provider = new LocalDiskStorageProvider(
    config.storageLocalRoot,
    `http://localhost:${config.port}`,
  );
  return provider;
}
