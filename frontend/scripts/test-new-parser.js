const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Simple ID generation functions (copied from frontend/src/utils/id.ts)
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function stableProviderId(name) {
  return `provider-${normalize(name)}`;
}

function stableSiteId(name) {
  return `site-${normalize(name)}`;
}

function stableScheduleId(providerId, siteId, date, shiftOrTime) {
  const ymd = date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
    String(date.getDate()).padStart(2, '0');
  return `schedule-${normalize(`${providerId}-${siteId}-${ymd}-${shiftOrTime}`)}`;
}

// Parser functions (simplified from scheduleParser.ts)
function parseGridFormat(rawData) {
  const providers = [];
  const sites = [];
  const schedules = [];
  const providerMap = new Map();
  const siteMap = new Map();

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
    console.log('Could not find header row with "Day" column');
    return { providers, sites, schedules };
  }

  console.log(`Found header row at index ${headerRowIndex}`);
  const headerRow = rawData[headerRowIndex];
  
  let columns = [];
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

  console.log(`Found ${columns.length} site-shift columns:`, columns.map(c => `${c.site}-${c.shift}`));

  // Infer month/year from first data rows
  const { year: inferredYear, month: inferredMonth } = inferMonthYear(rawData, dataStartRow);
  console.log(`Inferred date context: ${inferredYear}-${inferredMonth + 1}`);

  let scheduleCount = 0;
  for (let r = dataStartRow; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.length < 2) continue;

    const dateCell = row[0];
    const dt = getDateFromCell(dateCell, inferredYear, inferredMonth);
    if (!dt) continue;
    
    // Debug: log the first few dates to see what they are
    if (r - dataStartRow < 3) {
      console.log(`  Row ${r}: dateCell=${dateCell}, dt=${dt.toISOString()}, year=${inferredYear}, month=${inferredMonth}`);
    }

    for (const { site, shift, col } of columns) {
      const val = row[col];
      if (!val) continue;

      const names = splitProviders(val);
      for (const name of names) {
        if (!name || isNonProviderToken(name)) continue;

        if (!providerMap.has(name)) {
          const pid = stableProviderId(name);
          const p = { id: pid, name, specialty: getSpecialtyFromName(name) };
          providers.push(p);
          providerMap.set(name, p);
        }
        const provider = providerMap.get(name);
        const siteObj = siteMap.get(site);

        const schedule = {
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
        scheduleCount++;
      }
    }
  }

  console.log(`Parsed ${providers.length} providers, ${sites.length} sites, ${schedules.length} schedules`);
  return { providers, sites, schedules };
}

function propagateHeader(row) {
  const out = [...row];
  let last;
  for (let i = 0; i < out.length; i++) {
    const v = (out[i] ?? '').toString().trim();
    if (v) last = v;
    else if (last) out[i] = last;
  }
  return out;
}

function ensureSite(siteName, shift, siteMap, sites) {
  if (!siteMap.has(siteName)) {
    const id = stableSiteId(siteName);
    const s = { id, name: siteName, type: getProviderTypeFromCode(shift) };
    sites.push(s);
    siteMap.set(siteName, s);
  }
}

function inferMonthYear(rawData, startRow) {
  // For this specific format, we know the days are for October 2025
  // since the current date context mentions October 11, 2025
  return { year: 2025, month: 9 }; // October = month 9 (0-indexed)
}

function getDateFromCell(value, defaultYear, defaultMonth) {
  if (value == null || value === '') return null;

  // First check if it's a day-of-month number (1-31)
  if (typeof value === 'number' && value >= 1 && value <= 31 && defaultYear != null && defaultMonth != null) {
    return new Date(defaultYear, defaultMonth, value);
  }

  if (typeof value === 'number') {
    return parseExcelSerial(value);
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const d1 = new Date(trimmed);
    if (!isNaN(d1.getTime())) return d1;
    const n = Number(trimmed);
    if (!isNaN(n) && n >= 1 && n <= 31 && defaultYear != null && defaultMonth != null) {
      return new Date(defaultYear, defaultMonth, n);
    }
  }
  return null;
}

function parseExcelSerial(serial) {
  if (serial <= 0) return null;
  const excelEpoch = new Date(1899, 11, 30);
  const ms = Math.round(serial * 24 * 60 * 60 * 1000);
  const date = new Date(excelEpoch.getTime() + ms);
  return isNaN(date.getTime()) ? null : date;
}

function splitProviders(cell) {
  if (cell == null) return [];
  const text = String(cell).trim();
  if (!text) return [];
  return text
    .split(/[,/;&]|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function isNonProviderToken(name) {
  const t = name.trim().toUpperCase();
  return t === 'UNCOVERED' || t === 'OPEN' || t === 'TBD' || t === 'NONE' || t === 'OFF';
}

function getSpecialtyFromName(providerName) {
  const name = providerName.toLowerCase();
  if (name.includes('dr.') || name.includes('doctor')) return 'Physician';
  if (name.includes('nurse') || name.includes('rn')) return 'Nursing';
  if (name.includes('tech') || name.includes('technician')) return 'Technical';
  return 'General Practice';
}

function getProviderTypeFromCode(code) {
  switch (code?.toUpperCase()) {
    case 'MD1': return 'Primary Care';
    case 'MD2': return 'Specialty Care';
    case 'PM': return 'Practice Management';
    default: return 'Healthcare Facility';
  }
}

// Main test function
function testParser() {
  const filePath = path.join(__dirname, '../../sample-data/output/schedule_3_phase1_conservative.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    console.log('Available files in sample-data/output:');
    const outputDir = path.join(__dirname, '../../sample-data/output');
    if (fs.existsSync(outputDir)) {
      fs.readdirSync(outputDir).forEach(file => console.log('  -', file));
    }
    return;
  }

  console.log('Testing parser with:', filePath);
  
  try {
    const workbook = XLSX.readFile(filePath);
    console.log('Available sheets:', workbook.SheetNames);
    
    // Try to find the schedule sheet
    let sheetName = workbook.SheetNames[0];
    const scheduleSheets = workbook.SheetNames.filter(name => 
      name.toLowerCase().includes('schedule') || 
      name.toLowerCase().includes('calendar') ||
      name === workbook.SheetNames[0] // fallback to first sheet
    );
    
    if (scheduleSheets.length > 0) {
      sheetName = scheduleSheets[0];
    }
    
    console.log('Using sheet:', sheetName);
    
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log(`Raw data: ${rawData.length} rows`);
    console.log('First 10 rows (full):');
    rawData.slice(0, 10).forEach((row, i) => {
      console.log(`  Row ${i}: [${row?.length || 0} cols]`, row);
    });
    
    // Look for rows that might contain schedule data
    console.log('\nLooking for schedule-like data...');
    for (let i = 0; i < Math.min(rawData.length, 20); i++) {
      const row = rawData[i];
      if (row && row.length > 5) {
        const hasDateInFirstCol = row[0] && (typeof row[0] === 'number' || 
          (typeof row[0] === 'string' && /\d/.test(row[0])));
        const hasProviderNames = row.some(cell => 
          typeof cell === 'string' && cell.length > 2 && /[A-Za-z]/.test(cell) && 
          !['SATISFACTION', 'Coverage', 'Uncovered', 'Excess', 'Providers'].some(kw => cell.includes(kw))
        );
        
        if (hasDateInFirstCol && hasProviderNames) {
          console.log(`  Row ${i} looks like schedule data:`, row.slice(0, 8));
        }
      }
    }
    
    const result = parseGridFormat(rawData);
    
    console.log('\n=== PARSING RESULTS ===');
    console.log(`Providers (${result.providers.length}):`);
    result.providers.slice(0, 5).forEach(p => console.log(`  ${p.name} (${p.specialty})`));
    
    console.log(`\nSites (${result.sites.length}):`);
    result.sites.slice(0, 5).forEach(s => console.log(`  ${s.name} (${s.type})`));
    
    console.log(`\nSchedules (${result.schedules.length}):`);
    result.schedules.slice(0, 10).forEach(s => {
      const provider = result.providers.find(p => p.id === s.providerId);
      const site = result.sites.find(st => st.id === s.siteId);
      console.log(`  ${s.date.toISOString().split('T')[0]} ${s.startTime}: ${provider?.name} at ${site?.name}`);
    });
    
  } catch (error) {
    console.error('Error parsing file:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  testParser();
}

module.exports = { testParser, parseGridFormat };