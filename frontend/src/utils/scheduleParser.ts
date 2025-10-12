import * as XLSX from 'xlsx';
import { ScheduleData, Provider, Site, ScheduleEntry } from '../components/types/schedule';
import { stableProviderId, stableSiteId, stableScheduleId } from './id';

// Entry point: parse Excel file supporting multiple header formats including
// two-row site + shift headers used by "schedule_3_phase1_conservative.xlsx".
export const parseScheduleExcel = async (file: File): Promise<ScheduleData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data as any, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // First, try array-of-arrays to detect complex headers
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (rawData && rawData.length >= 2) {
          const scheduleData = parseGridFormat(rawData);
          resolve(scheduleData);
          return;
        }

        // Fallback: traditional row objects ("Provider", "Site", etc.)
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        if (jsonData && jsonData.length > 0) {
          const scheduleData = parseSimpleScheduleData(jsonData);
          resolve(scheduleData);
          return;
        }

        reject(new Error('Unrecognized Excel format'));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

// Parse array-of-arrays grid format. Handles:
// - One-row headers with "Site - Shift"
// - Two-row headers where row 0 = Site (merged across columns), row 1 = Shift (MD1/MD2/PM/etc.)
// - First column as Date, Excel serial, or day-of-month; infers month/year from first parseable date
// - Files with statistics/summary rows before the actual schedule data
const parseGridFormat = (rawData: any[][]): ScheduleData => {
  const providers: Provider[] = [];
  const sites: Site[] = [];
  const schedules: ScheduleEntry[] = [];

  const providerMap = new Map<string, Provider>();
  const siteMap = new Map<string, Site>();

  if (rawData.length < 2) throw new Error('Invalid schedule format');

  // Find the header row (contains "Day" and site-shift patterns)
  let headerRowIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row.length > 5 && row[0] === 'Day') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    // Fallback: try original logic for two-row headers
    const row0 = rawData[0] || [];
    const row1 = rawData[1] || [];

    const propagatedRow0 = propagateHeader(row0);
    const shiftLike = (v: any) => typeof v === 'string' && /^[A-Za-z0-9]{1,5}$/.test(v.trim());
    const row1HasShifts = row1.slice(1).some(shiftLike);

    type ColMap = { site: string; shift: string; col: number }[];
    let columns: ColMap = [];
    let dataStartRow = 1;

    if (row1HasShifts && propagatedRow0.slice(1).some(v => typeof v === 'string' && v.trim().length > 0)) {
      // Two-row header
      for (let c = 1; c < Math.max(propagatedRow0.length, row1.length); c++) {
        const siteCell = (propagatedRow0[c] ?? '').toString().trim();
        const shiftCell = (row1[c] ?? '').toString().trim();
        if (!siteCell || !shiftCell) continue;
        columns.push({ site: siteCell, shift: shiftCell, col: c });
        ensureSite(siteCell, shiftCell, siteMap, sites);
      }
      dataStartRow = 2;
    } else {
      // One-row header with "Site - Shift"
      for (let c = 1; c < row0.length; c++) {
        const header = row0[c];
        if (!header || typeof header !== 'string') continue;
        const parts = header.split(' - ');
        if (parts.length >= 2) {
          const site = parts[0].trim();
          const shift = parts.slice(1).join(' - ').trim();
          if (!site || !shift) continue;
          columns.push({ site, shift, col: c });
          ensureSite(site, shift, siteMap, sites);
        }
      }
      dataStartRow = 1;
    }

    // Infer month/year for rows where first col is day-of-month only
    const { year: inferredYear, month: inferredMonth } = inferMonthYear(rawData, dataStartRow);

    for (let r = dataStartRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length < 2) continue;

      const dateCell = row[0];
      const dt = getDateFromCell(dateCell, inferredYear, inferredMonth);
      if (!dt) continue;

      for (const { site, shift, col } of columns) {
        const val = row[col];
        if (!val) continue;

        const names = splitProviders(val);
        for (const name of names) {
          if (!name) continue;
          if (isNonProviderToken(name)) continue;

          if (!providerMap.has(name)) {
            const pid = stableProviderId(name);
            const p: Provider = { id: pid, name, specialty: getSpecialtyFromName(name) };
            providers.push(p);
            providerMap.set(name, p);
          }
          const provider = providerMap.get(name)!;
          const siteObj = siteMap.get(site)!;

          const schedule: ScheduleEntry = {
            id: stableScheduleId(provider.id, siteObj.id, dt, shift),
            providerId: provider.id,
            siteId: siteObj.id,
            date: new Date(dt),
            startTime: shift,
            endTime: '',
            status: 'scheduled',
            notes: undefined,
          };
          schedules.push(schedule);
        }
      }
    }

    return { providers, sites, schedules };
  }

  // Handle format with "Day" header (like schedule_3_phase1_conservative.xlsx)
  const headerRow = rawData[headerRowIndex];
  let columns: { site: string; shift: string; col: number }[] = [];
  let dataStartRow = headerRowIndex + 1;

  // Parse "Site - Shift" headers
  for (let c = 1; c < headerRow.length; c++) {
    const header = headerRow[c];
    if (!header || typeof header !== 'string') continue;
    const parts = header.split(' - ');
    if (parts.length >= 2) {
      const site = parts[0].trim();
      const shift = parts.slice(1).join(' - ').trim();
      if (!site || !shift) continue;
      columns.push({ site, shift, col: c });
      ensureSite(site, shift, siteMap, sites);
    }
  }

  // Infer month/year from first data rows or use current context (October 2025)
  const { year: inferredYear, month: inferredMonth } = inferMonthYear(rawData, dataStartRow);

  for (let r = dataStartRow; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.length < 2) continue;

    const dateCell = row[0];
    const dt = getDateFromCell(dateCell, inferredYear, inferredMonth);
    if (!dt) continue;

    for (const { site, shift, col } of columns) {
      const val = row[col];
      if (!val) continue;

      const names = splitProviders(val);
      for (const name of names) {
        if (!name) continue;
        if (isNonProviderToken(name)) continue;

        if (!providerMap.has(name)) {
          const pid = stableProviderId(name);
          const p: Provider = { id: pid, name, specialty: getSpecialtyFromName(name) };
          providers.push(p);
          providerMap.set(name, p);
        }
        const provider = providerMap.get(name)!;
        const siteObj = siteMap.get(site)!;

        const schedule: ScheduleEntry = {
          id: stableScheduleId(provider.id, siteObj.id, dt, shift),
          providerId: provider.id,
          siteId: siteObj.id,
          date: new Date(dt),
          startTime: shift,
          endTime: '',
          status: 'scheduled',
          notes: undefined,
        };
        schedules.push(schedule);
      }
    }
  }

  return { providers, sites, schedules };
};

function propagateHeader(row: any[]): any[] {
  const out = [...row];
  let last: string | undefined;
  for (let i = 0; i < out.length; i++) {
    const v = (out[i] ?? '').toString().trim();
    if (v) last = v;
    else if (last) out[i] = last;
  }
  return out;
}

function ensureSite(siteName: string, shift: string, siteMap: Map<string, Site>, sites: Site[]) {
  if (!siteMap.has(siteName)) {
    const id = stableSiteId(siteName);
    const s: Site = { id, name: siteName, type: getProviderTypeFromCode(shift) };
    sites.push(s);
    siteMap.set(siteName, s);
  }
}

function inferMonthYear(rawData: any[][], startRow: number): { year: number; month: number } {
  // First, try to find a full date in the first few rows
  for (let r = startRow; r < Math.min(startRow + 10, rawData.length); r++) {
    const cell = rawData[r]?.[0];
    const d = getDateFromCell(cell);
    if (d && d.getFullYear() > 1900) { // Valid full date
      return { year: d.getFullYear(), month: d.getMonth() };
    }
  }
  
  // For schedule files with day-of-month numbers, assume current context (October 2025)
  // This handles files like schedule_3_phase1_conservative.xlsx
  const today = new Date();
  if (today.getFullYear() === 2025 && today.getMonth() === 9) { // October 2025
    return { year: 2025, month: 9 }; // October
  }
  
  // Default fallback
  return { year: today.getFullYear(), month: today.getMonth() };
}

function getDateFromCell(value: any, defaultYear?: number, defaultMonth?: number): Date | null {
  if (value == null || value === '') return null;

  // First check if it's a day-of-month number (1-31) with default year/month
  if (typeof value === 'number' && value >= 1 && value <= 31 && defaultYear != null && defaultMonth != null) {
    return new Date(defaultYear, defaultMonth, value);
  }

  if (typeof value === 'number') {
    // Excel serial date
    return parseExcelSerial(value);
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Try native parse first
    const d1 = new Date(trimmed);
    if (!isNaN(d1.getTime())) return d1;
    // Day-of-month only (e.g., "16")
    const n = Number(trimmed);
    if (!isNaN(n) && n >= 1 && n <= 31 && defaultYear != null && defaultMonth != null) {
      return new Date(defaultYear, defaultMonth, n);
    }
  }
  return null;
}

function parseExcelSerial(serial: number): Date | null {
  if (serial <= 0) return null;
  // Excel's epoch (accounting for 1900 leap year bug)
  const excelEpoch = new Date(1899, 11, 30);
  const ms = Math.round(serial * 24 * 60 * 60 * 1000);
  const date = new Date(excelEpoch.getTime() + ms);
  return isNaN(date.getTime()) ? null : date;
}

function splitProviders(cell: any): string[] {
  if (cell == null) return [];
  const text = String(cell).trim();
  if (!text) return [];
  return text
    .split(/[,/;&]|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function isNonProviderToken(name: string): boolean {
  const t = name.trim().toUpperCase();
  return t === 'UNCOVERED' || t === 'OPEN' || t === 'TBD' || t === 'NONE' || t === 'OFF';
}

// Simple parser for old format (traditional columns like "Provider", "Site", etc.)
const parseSimpleScheduleData = (data: any[]): ScheduleData => {
  const providers: Provider[] = [];
  const sites: Site[] = [];
  const schedules: ScheduleEntry[] = [];

  const providerMap = new Map<string, Provider>();
  const siteMap = new Map<string, Site>();

  for (const row of data) {
    const providerName = row['Provider'] || row['provider'] || row['Provider Name'];
    if (providerName && !providerMap.has(providerName)) {
      const providerId = stableProviderId(String(providerName));
      const provider: Provider = {
        id: providerId,
        name: providerName,
        specialty: row['Specialty'] || row['specialty'] || 'General Practice'
      };
      providers.push(provider);
      providerMap.set(providerName, provider);
    }

    const siteName = row['Site'] || row['site'] || row['Facility'] || row['Location'];
    if (siteName && !siteMap.has(siteName)) {
      const siteId = stableSiteId(String(siteName));
      const site: Site = {
        id: siteId,
        name: siteName,
        type: row['Site Type'] || row['Type'] || 'Healthcare Facility'
      };
      sites.push(site);
      siteMap.set(siteName, site);
    }

    const date = getDateFromCell(row['Date'] || row['date'] || row['Schedule Date']);
    const startTime = row['Start Time'] || row['start_time'] || row['Start'];
    const endTime = row['End Time'] || row['end_time'] || row['End'];

    if (date && startTime && providerName && siteName) {
      const providerId = providerMap.get(providerName)!.id;
      const siteId = siteMap.get(siteName)!.id;
      const schedule: ScheduleEntry = {
        id: stableScheduleId(providerId, siteId, date, `${startTime}_${endTime || ''}`),
        providerId,
        siteId,
        date: date,
        startTime: startTime,
        endTime: endTime || '',
        status: 'scheduled',
        notes: row['Notes'] || row['notes']
      };
      schedules.push(schedule);
    }
  }

  return { providers, sites, schedules };
};

const getSpecialtyFromName = (providerName: string): string => {
  const name = providerName.toLowerCase();
  if (name.includes('dr.') || name.includes('doctor')) return 'Physician';
  if (name.includes('nurse') || name.includes('rn')) return 'Nursing';
  if (name.includes('tech') || name.includes('technician')) return 'Technical';
  return 'General Practice';
};

const getProviderTypeFromCode = (code: string): string => {
  switch (code?.toUpperCase()) {
    case 'MD1':
      return 'Primary Care';
    case 'MD2':
      return 'Specialty Care';
    case 'PM':
      return 'Practice Management';
    default:
      return 'Healthcare Facility';
  }
};

// Keep the existing simple parser for backward compatibility
export const parseExcelFile = parseScheduleExcel;



// Updated sample data to match the real structure better
export const getSampleScheduleData = (): ScheduleData => {
  const providers: Provider[] = [
    { id: 'p1', name: 'Logan Stevens', specialty: 'General Practice' },
    { id: 'p2', name: 'Parker Parker', specialty: 'General Practice' },
    { id: 'p3', name: 'Riley Keller', specialty: 'General Practice' },
    { id: 'p4', name: 'Hayden Reed', specialty: 'General Practice' },
    { id: 'p5', name: 'Miles Walker', specialty: 'General Practice' },
    { id: 'p6', name: 'Jordan Collins', specialty: 'General Practice' },
    { id: 'p7', name: 'Cameron Collins', specialty: 'Specialty Care' },
    { id: 'p8', name: 'Miles Foster', specialty: 'Specialty Care' },
    { id: 'p9', name: 'Spencer Davis', specialty: 'Practice Management' },
    { id: 'p10', name: 'Aiden Reed', specialty: 'Practice Management' }
  ];

  const sites: Site[] = [
    { id: 's1', name: 'Wnorth', type: 'Primary Care' },
    { id: 's2', name: 'Wbrier', type: 'Primary Care' },
    { id: 's3', name: 'WRMC', type: 'Primary Care' },
    { id: 's4', name: 'SSMM', type: 'Primary Care' },
    { id: 's5', name: 'RMC', type: 'Primary Care' },
    { id: 's6', name: 'NNSMC', type: 'Specialty Care' },
    { id: 's7', name: 'NNMC', type: 'Specialty Care' },
    { id: 's8', name: 'MMC', type: 'Practice Management' },
    { id: 's9', name: 'WCCH', type: 'Practice Management' },
    { id: 's10', name: 'VMH', type: 'Primary Care' }
  ];

  const schedules: ScheduleEntry[] = [
    // October 16, 2025 (Wednesday)
    { id: 'sch1', providerId: 'p1', siteId: 's1', date: new Date(2025, 9, 16), startTime: 'MD1', endTime: '', status: 'scheduled' },
    { id: 'sch2', providerId: 'p2', siteId: 's3', date: new Date(2025, 9, 16), startTime: 'MD1', endTime: '', status: 'scheduled' },
    { id: 'sch3', providerId: 'p3', siteId: 's4', date: new Date(2025, 9, 16), startTime: 'MD2', endTime: '', status: 'scheduled' },
    
    // October 17, 2025 (Thursday)  
    { id: 'sch4', providerId: 'p5', siteId: 's1', date: new Date(2025, 9, 17), startTime: 'MD1', endTime: '', status: 'scheduled' },
    { id: 'sch5', providerId: 'p2', siteId: 's3', date: new Date(2025, 9, 17), startTime: 'MD2', endTime: '', status: 'scheduled' },
    { id: 'sch6', providerId: 'p7', siteId: 's6', date: new Date(2025, 9, 17), startTime: 'PM', endTime: '', status: 'scheduled' },
    
    // October 18, 2025 (Friday)
    { id: 'sch7', providerId: 'p1', siteId: 's2', date: new Date(2025, 9, 18), startTime: 'MD1', endTime: '', status: 'scheduled' },
    { id: 'sch8', providerId: 'p6', siteId: 's5', date: new Date(2025, 9, 18), startTime: 'MD2', endTime: '', status: 'scheduled' },
    { id: 'sch9', providerId: 'p9', siteId: 's8', date: new Date(2025, 9, 18), startTime: 'PM', endTime: '', status: 'scheduled' },
    
    // October 19, 2025 (Saturday)
    { id: 'sch10', providerId: 'p5', siteId: 's1', date: new Date(2025, 9, 19), startTime: 'MD1', endTime: '', status: 'scheduled' },
    { id: 'sch11', providerId: 'p10', siteId: 's9', date: new Date(2025, 9, 19), startTime: 'PM', endTime: '', status: 'scheduled' },
    { id: 'sch12', providerId: 'p8', siteId: 's7', date: new Date(2025, 9, 19), startTime: 'MD2', endTime: '', status: 'scheduled' }
  ];

  return { providers, sites, schedules };
};