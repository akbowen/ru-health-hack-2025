import { dbRun } from './db';

// Seed default admin and physician demo users
const users = [
  { username: 'admin', password: 'admin123', role: 'admin', providerId: null },
  { username: 'physician', password: 'physician123', role: 'physician', providerId: null },
];

async function seed() {
  for (const u of users) {
    try {
      await dbRun('INSERT OR IGNORE INTO users (username, password, role, providerId) VALUES (?,?,?,?)',
        [u.username, u.password, u.role, u.providerId]);
    } catch (e) {
      console.warn('Seed error:', e);
    }
  }
  console.log('Seeded users');
}

seed();
