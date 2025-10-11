import sqlite3 from 'sqlite3';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data.sqlite');

const db = new sqlite3.Database(dbPath);

// Initialize tables if not exist
const initSql = `
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','physician','hospital')),
  providerId TEXT,
  siteId TEXT
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

// Migration: Add siteId column and update role constraint
db.serialize(() => {
  // Check if siteId column exists and add it if not
  db.all(`PRAGMA table_info(users)`, (err: any, rows: any[]) => {
    if (err) {
      console.error('Error checking table schema:', err);
      return;
    }
    
    const hasSiteId = rows.some((row: any) => row.name === 'siteId');
    
    // Check the current table definition to see if it has the hospital role
    db.all(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`, (err: any, tableRows: any[]) => {
      if (err) {
        console.error('Error checking users table constraint:', err);
        return;
      }
      
      const needsRoleUpdate = tableRows.length > 0 && !tableRows[0].sql.includes("'hospital'");
      
      if (!hasSiteId || needsRoleUpdate) {
        console.log('Migrating users table to add siteId column and hospital role...');
        
        // Create a backup of existing data
        db.all(`SELECT * FROM users`, (err: any, userData: any[]) => {
          if (err) {
            console.error('Error backing up user data:', err);
            return;
          }
          
          // Recreate the table with the correct schema
          db.serialize(() => {
            db.run(`DROP TABLE IF EXISTS users_backup`);
            db.run(`ALTER TABLE users RENAME TO users_backup`);
            
            db.run(`CREATE TABLE users (
              username TEXT PRIMARY KEY,
              password TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('admin','physician','hospital')),
              providerId TEXT,
              siteId TEXT
            )`, (err: any) => {
              if (err) {
                console.error('Error creating new users table:', err);
                return;
              }
              
              // Migrate existing data
              userData.forEach((user: any) => {
                db.run(`INSERT INTO users (username, password, role, providerId, siteId) VALUES (?,?,?,?,?)`,
                  [user.username, user.password, user.role, user.providerId || null, user.siteId || null],
                  (err: any) => {
                    if (err) {
                      console.error('Error migrating user:', user.username, err);
                    }
                  }
                );
              });
              
              // Clean up backup table
              db.run(`DROP TABLE users_backup`, (err: any) => {
                if (err) {
                  console.error('Error dropping backup table:', err);
                } else {
                  console.log('Successfully migrated users table with hospital role support');
                }
              });
            });
          });
        });
      } else {
        console.log('Users table is already up to date');
      }
    });
  });
});

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
