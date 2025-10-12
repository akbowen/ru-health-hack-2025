import express, { Request, Response, RequestHandler } from 'express'; // + RequestHandler
import cors from 'cors';
import { z } from 'zod';
import { dbGet, dbAll, dbRun } from './db';
import multer from 'multer';
import { runScheduler } from './scheduler';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Users API
const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(['admin', 'physician', 'hospital']),
  providerId: z.string().optional().transform(val => val === '' ? undefined : val),
  siteId: z.string().optional().transform(val => val === '' ? undefined : val)
});

const updateUserSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  role: z.enum(['admin', 'physician', 'hospital']).optional(),
  providerId: z.string().optional().transform(val => val === '' ? undefined : val),
  siteId: z.string().optional().transform(val => val === '' ? undefined : val)
});

app.get('/api/users', async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll('SELECT username, role, providerId, siteId FROM users');
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users', async (req: Request, res: Response) => {
  console.log('Creating user with data:', req.body);
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log('Validation failed:', parsed.error.format());
    return res.status(400).json({ error: parsed.error.format() });
  }
  const { username, password, role, providerId, siteId } = parsed.data;
  try {
    await dbRun('INSERT INTO users (username, password, role, providerId, siteId) VALUES (?,?,?,?,?)',
      [username, password, role, providerId ?? null, siteId ?? null]);
    res.status(201).json({ ok: true });
  } catch (e: any) {
    console.log('Database error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/users/:username', async (req: Request, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const { password, role, providerId, siteId } = parsed.data;
  const { username } = req.params;
  try {
    const existing = await dbGet('SELECT * FROM users WHERE username=?', [username]);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const newPassword = password ?? existing.password;
    const newRole = role ?? existing.role;
    const newProviderId = providerId ?? existing.providerId;
    const newSiteId = siteId ?? existing.siteId;
    await dbRun('UPDATE users SET password=?, role=?, providerId=?, siteId=? WHERE username=?',
      [newPassword, newRole, newProviderId, newSiteId, username]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:username', async (req: Request, res: Response) => {
  const { username } = req.params;
  try {
    await dbRun('DELETE FROM users WHERE username=?', [username]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Auth (very basic demo)
app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const row = await dbGet('SELECT username, role, providerId, siteId FROM users WHERE username=? AND password=?', [username, password]);
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Providers/Sites/Schedules basic endpoints for syncing parsed data
app.post('/api/providers/bulk', async (req: Request, res: Response) => {
  try {
    const providers = z.array(z.object({ id: z.string(), name: z.string() })).parse(req.body);
    for (const p of providers) {
      await dbRun('INSERT OR REPLACE INTO providers (id, name) VALUES (?, ?)', [p.id, p.name]);
    }
    res.json({ ok: true, count: providers.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sites/bulk', async (req: Request, res: Response) => {
  try {
    const sites = z.array(z.object({ id: z.string(), name: z.string() })).parse(req.body);
    for (const s of sites) {
      await dbRun('INSERT OR REPLACE INTO sites (id, name) VALUES (?, ?)', [s.id, s.name]);
    }
    res.json({ ok: true, count: sites.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/schedules/bulk', async (req: Request, res: Response) => {
  try {
    const schedules = z.array(z.object({
      id: z.string(),
      providerId: z.string(),
      siteId: z.string(),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      status: z.string(),
      notes: z.string().optional()
    })).parse(req.body);
    for (const s of schedules) {
      await dbRun('INSERT OR REPLACE INTO schedules (id, providerId, siteId, date, startTime, endTime, status, notes) VALUES (?,?,?,?,?,?,?,?)',
        [s.id, s.providerId, s.siteId, s.date, s.startTime, s.endTime, s.status, s.notes ?? null]);
    }
    res.json({ ok: true, count: schedules.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET endpoints for retrieving stored data
app.get('/api/providers', async (req: Request, res: Response) => {
  try {
    const providers = await dbAll('SELECT id, name FROM providers ORDER BY name');
    res.json(providers);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sites', async (req: Request, res: Response) => {
  try {
    const sites = await dbAll('SELECT id, name FROM sites ORDER BY name');
    res.json(sites);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// Object to save the files
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB/file
  fileFilter: (_req, file, cb) => {
    const okExt = file.originalname.toLowerCase().endsWith('.xlsx');
    const okMime =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/octet-stream';
    if (okExt && okMime) return cb(null, true);
    cb(new Error('Only .xlsx files are allowed'));
  },
});


type UploadFields = {
  providerAvailability?: Express.Multer.File[];
  providerContract?: Express.Multer.File[];
  providerCredentialing?: Express.Multer.File[];
  facilityVolume?: Express.Multer.File[];
  facilityCoverage?: Express.Multer.File[]
};

app.post(
  '/api/schedule/upload',
  memUpload.fields([
    { name: 'providerAvailability', maxCount: 1 },
    { name: 'providerContract', maxCount: 1 },
    { name: 'providerCredentialing', maxCount: 1 },
    { name: 'facilityVolume', maxCount: 1 },
    { name: 'facilityCoverage', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as UploadFields;

      // presence checks
      const need: (keyof UploadFields)[] = [
        'providerAvailability',
        'providerContract',
        'providerCredentialing',
        'facilityVolume',
        'facilityCoverage'
      ];
      for (const k of need) {
        if (!files?.[k]?.[0]?.buffer) {
          return res.status(400).json({ error: `Missing file for '${k}'` });
        }
      }

      // Run your Node scheduler logic
      const out = runScheduler({
        availabilityXlsx: files.providerAvailability![0].buffer,
        contractXlsx: files.providerContract![0].buffer,
        credentialingXlsx: files.providerCredentialing![0].buffer,
        volumeXlsx: files.facilityVolume![0].buffer,
        coverageXlsx: files.facilityCoverage![0].buffer,
      });

      res.json({
        ok: true
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);


app.get('/api/schedules', async (req: Request, res: Response) => {
  try {
    const schedules = await dbAll('SELECT id, providerId, siteId, date, startTime, endTime, status, notes FROM schedules ORDER BY date, startTime');
    res.json(schedules);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Reset schedules, providers, and sites (does not affect users)
app.post('/api/schedule/reset', async (_req: Request, res: Response) => {
  try {
    // Clear in child->parent order to avoid FK issues
    await dbRun('DELETE FROM schedules');
    await dbRun('DELETE FROM providers');
    await dbRun('DELETE FROM sites');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});




