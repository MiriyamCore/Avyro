import { createReadStream, createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { TarArchive } from 'archiver';
import { extract as extractTar } from 'tar';
import type { PortableBackupPayload } from './backup-serialize.js';
import { exportOrganizationData, restoreOrganizationData } from './backup-org-data.js';
import { filesBackupSourceRoot } from './backup-storage.js';

async function writeJsonGzip(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await pipeline(
    Readable.from(JSON.stringify(data)),
    createGzip(),
    createWriteStream(`${filePath}.gz`),
  );
}

async function readJsonGzip(filePath: string): Promise<unknown> {
  const chunks: Buffer[] = [];
  const stream = createReadStream(`${filePath}.gz`).pipe(createGunzip());
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function packDirectory(sourceDir: string, outputPath: string) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = new TarArchive({
      gzip: true,
      gzipOptions: { level: 9 },
    });
    output.on('close', () => resolve());
    archive.on('error', reject);
    output.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

/** Portable Avyro backup — pure Node.js, no pg_dump/psql/tar binaries. */
export async function createBackupArchive(options: {
  organizationId: string;
  outputPath: string;
}) {
  const workDir = path.join(os.tmpdir(), `avyro-backup-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  try {
    const payload = await exportOrganizationData(options.organizationId);
    await writeJsonGzip(path.join(workDir, 'data.json'), payload);

    const manifest = {
      version: 2,
      format: 'avyro-portable',
      organizationId: options.organizationId,
      createdAt: new Date().toISOString(),
      includes: ['data.json.gz', 'storage/'],
    };
    await writeFile(
      path.join(workDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );

    const orgStorageSrc = path.join(filesBackupSourceRoot(), options.organizationId);
    const storageDest = path.join(workDir, 'storage', options.organizationId);
    try {
      await cp(orgStorageSrc, storageDest, { recursive: true });
    } catch {
      await mkdir(storageDest, { recursive: true });
    }

    await packDirectory(workDir, options.outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function restoreBackupArchive(options: {
  archivePath: string;
  organizationId: string;
}) {
  const workDir = path.join(os.tmpdir(), `avyro-restore-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  try {
    await extractTar({ file: options.archivePath, cwd: workDir });

    const payload = (await readJsonGzip(
      path.join(workDir, 'data.json'),
    )) as PortableBackupPayload;

    await restoreOrganizationData(options.organizationId, payload);

    const orgStorageSrc = path.join(workDir, 'storage', options.organizationId);
    const legacyStorageSrc = path.join(workDir, 'storage');
    const storageDest = path.join(filesBackupSourceRoot(), options.organizationId);
    try {
      await cp(orgStorageSrc, storageDest, { recursive: true, force: true });
    } catch {
      try {
        await cp(legacyStorageSrc, filesBackupSourceRoot(), {
          recursive: true,
          force: true,
        });
      } catch {
        // empty storage is ok
      }
    }

    return { restored: true };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Detect legacy v1 SQL dumps inside an archive. */
export async function isLegacySqlBackup(archivePath: string): Promise<boolean> {
  const workDir = path.join(os.tmpdir(), `avyro-detect-${Date.now()}`);
  await mkdir(workDir, { recursive: true });
  try {
    await extractTar({ file: archivePath, cwd: workDir });
    const manifestRaw = await readFile(path.join(workDir, 'manifest.json'), 'utf8').catch(
      () => null,
    );
    if (manifestRaw) {
      const manifest = JSON.parse(manifestRaw) as { version?: number; format?: string };
      return manifest.version === 1 || !manifest.format;
    }
    return true;
  } catch {
    return false;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
