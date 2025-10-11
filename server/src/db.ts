import sqlite3 from 'sqlite3';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data.sqlite');

const db = new sqlite3.Database(dbPath);

// Initialize tables if not exist
const initSql = `
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','physician')),
  providerId TEXT
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  providerId TEXT NOT NULL,
  siteId TEXT NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY(providerId) REFERENCES providers(id),
  FOREIGN KEY(siteId) REFERENCES sites(id)
);
`;

db.exec(initSql);

// Helper functions to promisify sqlite3 operations
export const dbGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

export const dbRun = (sql: string, params: any[] = []): Promise<sqlite3.RunResult> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export default db;
