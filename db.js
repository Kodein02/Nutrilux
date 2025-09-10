import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH || 'nutrilux.db';
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS links(
  discord_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS states(
  discord_id TEXT PRIMARY KEY,
  status TEXT,
  variants TEXT,
  grace_until INTEGER,
  updated_at INTEGER
);
`);

export default db;
