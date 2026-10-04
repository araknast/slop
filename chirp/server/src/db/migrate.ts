import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const conn = await mysql.createConnection({ uri: config.mysqlUrl, multipleStatements: true });
await conn.query(
  'CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
);
const [rows] = await conn.query('SELECT name FROM _migrations');
const done = new Set((rows as { name: string }[]).map((r) => r.name));
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(file)) continue;
  await conn.query(await readFile(path.join(dir, file), 'utf8'));
  await conn.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
  console.log('applied', file);
}
await conn.end();
