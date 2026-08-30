import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { filesBackupSourceRoot } from './backup-storage.js';

export type DatabaseUrlParts = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export function parseDatabaseUrl(url: string): DatabaseUrlParts {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\//, '').split('?')[0] ?? 'avyro',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function runCommand(
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}: ${stderr}`));
    });
  });
}

async function pgDumpToGzip(db: DatabaseUrlParts, outputPath: string) {
  await new Promise<void>((resolve, reject) => {
    const dump = spawn(
      'pg_dump',
      ['--no-owner', '--no-acl', '--clean', '--if-exists', db.database],
      {
        env: {
          ...process.env,
          PGHOST: db.host,
          PGPORT: String(db.port),
          PGUSER: db.user,
          PGPASSWORD: db.password,
          PGDATABASE: db.database,
        },
      },
    );
    const gzip = createGzip();
    const out = createWriteStream(outputPath);
    dump.stdout.pipe(gzip).pipe(out);
    let stderr = '';
    dump.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    dump.on('error', reject);
    out.on('error', reject);
    dump.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump failed (${code}): ${stderr}`));
    });
  });
}

export async function createBackupArchive(options: {
  databaseUrl: string;
  organizationId: string;
  outputPath: string;
}) {
  const workDir = path.join(os.tmpdir(), `avyro-backup-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  const db = parseDatabaseUrl(options.databaseUrl);
  const sqlGzPath = path.join(workDir, 'database.sql.gz');
  await pgDumpToGzip(db, sqlGzPath);

  const manifest = {
    version: 1,
    organizationId: options.organizationId,
    createdAt: new Date().toISOString(),
    includes: ['database.sql.gz', 'storage/'],
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

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await runCommand('tar', ['-czf', options.outputPath, '-C', workDir, '.'], {});

  await rm(workDir, { recursive: true, force: true });
}

export async function restoreBackupArchive(options: {
  databaseUrl: string;
  archivePath: string;
  organizationId: string;
}) {
  const workDir = path.join(os.tmpdir(), `avyro-restore-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  await runCommand('tar', ['-xzf', options.archivePath, '-C', workDir], {});

  const sqlGzPath = path.join(workDir, 'database.sql.gz');
  const sqlPath = path.join(workDir, 'database.sql');
  await pipeline(
    createReadStream(sqlGzPath),
    createGunzip(),
    createWriteStream(sqlPath),
  );

  const db = parseDatabaseUrl(options.databaseUrl);
  const sql = await readFile(sqlPath, 'utf8');

  await runCommand(
    'psql',
    ['-v', 'ON_ERROR_STOP=1', '-f', sqlPath, db.database],
    {
      PGHOST: db.host,
      PGPORT: String(db.port),
      PGUSER: db.user,
      PGPASSWORD: db.password,
      PGDATABASE: db.database,
    },
  );

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
      // documents folder may be empty
    }
  }

  await rm(workDir, { recursive: true, force: true });

  return { restoredSqlBytes: Buffer.byteLength(sql) };
}
