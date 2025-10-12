import express, { Request, Response, RequestHandler } from 'express'; // + RequestHandler
import cors from 'cors';
import { z } from 'zod';
import { dbGet, dbAll, dbRun } from './db';
import multer from 'multer';
import { runScheduler } from './scheduler';
import axios from 'axios';
import FormData from 'form-data';

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
  // Treat empty string as undefined so password remains unchanged by default
  password: z.string().optional().transform(val => (val === '' ? undefined : val)),
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

app.post('/api/leave-requests', async (req: Request, res: Response) => {
  try {
    console.log('Received leave request:', req.body); // Add logging
    const { physicianId, physicianName, date, shiftType, siteId, siteName, reason } = req.body;
    
    // Validate required fields
    if (!physicianId || !physicianName || !date || !shiftType || !siteId || !siteName || !reason) {
      console.error('Missing required fields:', { physicianId, physicianName, date, shiftType, siteId, siteName, reason });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = `leave_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    
    console.log('Inserting leave request with ID:', id);
    await dbRun(
      `INSERT INTO leave_requests (id, physicianId, physicianName, date, shiftType, siteId, siteName, reason, status, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, physicianId, physicianName, date, shiftType, siteId, siteName, reason, createdAt]
    );
    
    console.log('Leave request created successfully');
    res.status(201).json({ ok: true, id });
  } catch (e: any) {
    console.error('Error creating leave request:', e);
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
    // If password is undefined (blank in UI), keep existing password
    const newPassword = password === undefined ? existing.password : password;
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

function appendFile(fd: FormData, fieldName: string, f: Express.Multer.File) {
  // ensure a filename and mimetype go over the wire
  const filename = f.originalname || `${fieldName}.xlsx`;
  const contentType = f.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  fd.append(fieldName, f.buffer, { filename, contentType });
}

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
        'facilityCoverage',
      ];
      for (const k of need) {
        if (!files?.[k]?.[0]?.buffer) {
          return res.status(400).json({ error: `Missing file for '${k}'` });
        }
      }

      // Build multipart form for Flask
      const fd = new FormData();
      appendFile(fd, 'providerAvailability', files.providerAvailability![0]);
      appendFile(fd, 'providerContract', files.providerContract![0]);
      appendFile(fd, 'providerCredentialing', files.providerCredentialing![0]);
      appendFile(fd, 'facilityVolume', files.facilityVolume![0]);
      appendFile(fd, 'facilityCoverage', files.facilityCoverage![0]);

      // POST to Flask; expect an Excel file stream when successful
      const flaskUrl = 'http://localhost:5051/api/run/scheduler';
      const flaskResp = await axios.post(flaskUrl, fd, {
        headers: fd.getHeaders(),
        responseType: 'stream',            // important: stream the XLSX back
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 15 * 60 * 1000,            // 5 min (adjust as needed)
        validateStatus: () => true,        // we'll handle status codes below
      });

      const ct = flaskResp.headers['content-type'] || '';
      const cd = flaskResp.headers['content-disposition'];

      // If Flask returned an Excel file, stream it through
      const isExcel =
        ct.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
        (cd && /filename=.*\.xlsx/i.test(String(cd)));

      if (flaskResp.status >= 200 && flaskResp.status < 300 && isExcel) {
        // Pass through headers that matter for download
        if (cd) res.setHeader('Content-Disposition', cd);
        else res.setHeader('Content-Disposition', 'attachment; filename="rank2.xlsx"');
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        // Pipe the Excel stream to client
        flaskResp.data.pipe(res);
        flaskResp.data.on('end', () => {
          // done
        });
        flaskResp.data.on('error', (err: any) => {
          console.error('Stream error from Flask:', err);
          if (!res.headersSent) res.status(502).json({ error: 'Upstream stream error' });
        });
        return;
      }

      // Otherwise, try to read JSON/text error payload and forward it
      // Because responseType:'stream', we need to buffer it if not Excel.
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        flaskResp.data.on('data', (c: Buffer) => chunks.push(c));
        flaskResp.data.on('end', () => resolve());
        flaskResp.data.on('error', reject);
      });

      const bodyStr = Buffer.concat(chunks).toString('utf8');
      let body: any = bodyStr;
      try { body = JSON.parse(bodyStr); } catch { /* not JSON; keep as string */ }

      res.status(flaskResp.status || 500).json(
        typeof body === 'string' ? { error: body } : body
      );
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal error' });
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

// ============ ADD THESE NEW ROUTES HERE ============

// Leave Requests API
app.get('/api/leave-requests', async (req: Request, res: Response) => {
  try {
    const { physicianId, siteId } = req.query;
    let query = 'SELECT * FROM leave_requests WHERE 1=1';
    const params: any[] = [];
    
    if (physicianId) {
      query += ' AND physicianId = ?';
      params.push(physicianId);
    }
    if (siteId) {
      query += ' AND siteId = ?';
      params.push(siteId);
    }
    
    query += ' ORDER BY createdAt DESC';
    const requests = await dbAll(query, params);
    res.json(requests);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/leave-requests', async (req: Request, res: Response) => {
  try {
    const { physicianId, physicianName, date, shiftType, siteId, siteName, reason } = req.body;
    const id = `leave_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    
    await dbRun(
      `INSERT INTO leave_requests (id, physicianId, physicianName, date, shiftType, siteId, siteName, reason, status, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, physicianId, physicianName, date, shiftType, siteId, siteName, reason, createdAt]
    );
    
    res.status(201).json({ ok: true, id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/leave-requests/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { respondedBy } = req.body;
    const respondedAt = new Date().toISOString();
    
    const request: any = await dbGet('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    await dbRun(
      'UPDATE leave_requests SET status = ?, respondedAt = ?, respondedBy = ? WHERE id = ?',
      ['approved', respondedAt, respondedBy, id]
    );
    
    await dbRun(
      'DELETE FROM schedules WHERE providerId = ? AND siteId = ? AND date = ? AND startTime = ?',
      [request.physicianId, request.siteId, request.date, request.shiftType]
    );
    
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await dbRun(
      `INSERT INTO availability_alerts (id, siteId, siteName, date, shiftType, originalPhysicianName, createdAt, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [alertId, request.siteId, request.siteName, request.date, request.shiftType, request.physicianName, new Date().toISOString()]
    );
    
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/leave-requests/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { respondedBy } = req.body;
    const respondedAt = new Date().toISOString();
    
    await dbRun(
      'UPDATE leave_requests SET status = ?, respondedAt = ?, respondedBy = ? WHERE id = ?',
      ['rejected', respondedAt, respondedBy, id]
    );
    
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Availability Alerts API
app.get('/api/availability-alerts', async (req: Request, res: Response) => {
  try {
    const { siteId, status } = req.query;
    let query = 'SELECT * FROM availability_alerts WHERE 1=1';
    const params: any[] = [];
    
    if (siteId) {
      query += ' AND siteId = ?';
      params.push(siteId);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY createdAt DESC';
    const alerts = await dbAll(query, params);
    res.json(alerts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/availability-alerts/:id/claim', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { physicianId, physicianName } = req.body;
    
    const alert: any = await dbGet('SELECT * FROM availability_alerts WHERE id = ?', [id]);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    if (alert.status !== 'open') {
      return res.status(400).json({ error: 'Alert already filled' });
    }
    
    await dbRun(
      'UPDATE availability_alerts SET status = ?, filledBy = ?, filledByName = ? WHERE id = ?',
      ['filled', physicianId, physicianName, id]
    );
    
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await dbRun(
      `INSERT INTO schedules (id, providerId, siteId, date, startTime, endTime, status, notes)
       VALUES (?, ?, ?, ?, ?, '', 'confirmed', 'Claimed from availability alert')`,
      [scheduleId, physicianId, alert.siteId, alert.date, alert.shiftType]
    );
    
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/leave-requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM leave_requests WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});




