import { runner } from 'node-pg-migrate';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  await runner({
    databaseUrl: env.databaseUrl,
    dir: path.join(__dirname, '../../migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: msg => logger.info(msg)
  });
}
