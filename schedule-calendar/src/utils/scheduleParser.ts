import * as XLSX from 'xlsx';
import { ScheduleData, Provider, Site, ScheduleEntry } from '../types/schedule';
import { stableProviderId, stableSiteId, stableScheduleId } from './id';

export const parseScheduleExcel = async (file: File): Promise<ScheduleData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Try default JSON parse first
        let jsonData = XLSX.utils.sheet_to_json(sheet);
        
        // Check if this is the new format by looking at column headers
        const isNewFormat = jsonData.length > 0 && jsonData[0] && 
          Object.keys(jsonData[0]).some(key => key.includes(' - '));
        
        if (jsonData.length > 0 && !isNewFormat) {
          // Old format - has columns like "Provider", "Site", etc.
          const scheduleData = parseSimpleScheduleData(jsonData);
          resolve(scheduleData);
          return;
        }

        // New format - use header: 1 (array of arrays) for better parsing
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (rawData.length > 0) {
          const scheduleData = parseComplexScheduleData(rawData);
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

const parseComplexScheduleData = (rawData: any[][]): ScheduleData => {
  const providers: Provider[] = [];
  const sites: Site[] = [];
  const schedules: ScheduleEntry[] = [];

  const providerMap = new Map<string, Provider>();
  const siteMap = new Map<string, Site>();

  if (rawData.length < 2) {
    throw new Error('Invalid schedule format - need at least 2 rows');
  }

  // Row 0 contains headers like "AHG - MD1", "AHG - MD2", "AHG - PM", etc.
  const headers = rawData[0];
  
  // Parse headers to extract site-shift combinations
  const siteShiftColumns: Array<{ site: string; shift: string; columnIndex: number }> = [];
  
  for (let colIndex = 1; colIndex < headers.length; colIndex++) {
    const header = headers[colIndex];
    if (header && typeof header === 'string') {
      const parts = header.split(' - ');
      if (parts.length >= 2) {
        const siteName = parts[0].trim();
        const shift = parts[1].trim();
        
        siteShiftColumns.push({
          site: siteName,
          shift: shift,
          columnIndex: colIndex
        });

        // Create site if not exists
        if (!siteMap.has(siteName)) {
          const siteId = stableSiteId(siteName);
          const site: Site = {
            id: siteId,
            name: siteName,
            type: getProviderTypeFromCode(shift)
          };
          sites.push(site);
          siteMap.set(siteName, site);
        }
      }
    }
  }

  // Parse data rows (starting from row 1)
  for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
    const row = rawData[rowIndex];
    if (!row || row.length < 2) continue;
    
    const dayNumber = row[0];
    if (typeof dayNumber !== 'number') continue;
    
    // Use the day number for October 2025
    const scheduleDate = new Date(2025, 9, dayNumber);
    
    // Process each site-shift column
    for (const siteShift of siteShiftColumns) {
      const providerName = row[siteShift.columnIndex];
      
      // Skip if empty, "UNCOVERED", or not a string
      if (!providerName || typeof providerName !== 'string' || providerName === 'UNCOVERED') {
        continue;
      }
      
      // Clean provider name
      const cleanProviderName = providerName.trim();
      if (!cleanProviderName) continue;

      // Create or get provider
      if (!providerMap.has(cleanProviderName)) {
        const providerId = stableProviderId(cleanProviderName);
        const provider: Provider = {
          id: providerId,
          name: cleanProviderName,
          specialty: getSpecialtyFromName(cleanProviderName)
        };
        providers.push(provider);
        providerMap.set(cleanProviderName, provider);
      }

      const provider = providerMap.get(cleanProviderName)!;
      const site = siteMap.get(siteShift.site)!;

      // Create schedule entry
      const schedule: ScheduleEntry = {
        id: stableScheduleId(provider.id, site.id, new Date(scheduleDate), siteShift.shift),
        providerId: provider.id,
        siteId: site.id,
        date: new Date(scheduleDate),
        startTime: siteShift.shift, // Use shift as start time (MD1, MD2, PM, etc.)
        endTime: '', // No end time data available
        status: 'scheduled',
        notes: undefined
      };
      schedules.push(schedule);
    }
  }

  return { providers, sites, schedules };
};

// Simple parser for old format (traditional columns like "Provider", "Site", etc.)
const parseSimpleScheduleData = (data: any[]): ScheduleData => {
  const providers: Provider[] = [];
  const sites: Site[] = [];
  const schedules: ScheduleEntry[] = [];
  
  const providerMap = new Map<string, Provider>();
  const siteMap = new Map<string, Site>();
  
  data.forEach((row, index) => {
    // Extract provider information
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
    
    // Extract site information
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
    
    // Extract schedule entry
    const date = parseDate(row['Date'] || row['date'] || row['Schedule Date']);
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
  });
  
  return { providers, sites, schedules };
};

const parseDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  // Handle Excel date serial numbers
  if (typeof dateValue === 'number') {
    // Excel dates are stored as days since January 1, 1900
    // Account for Excel's leap year bug (treats 1900 as a leap year)
    const excelEpoch = new Date(1900, 0, 1);
    const days = dateValue > 59 ? dateValue - 1 : dateValue; // Adjust for the leap year bug
    const date = new Date(excelEpoch.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Handle string dates
  if (typeof dateValue === 'string') {
    // Try different date formats
    const formats = [
      dateValue, // Original format
      dateValue.replace(/-/g, '/'), // Convert dashes to slashes
      dateValue.replace(/\//g, '-'), // Convert slashes to dashes
    ];
    
    for (const format of formats) {
      const parsedDate = new Date(format);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return null;
  }
  
  // Handle Date objects
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }
  
  return null;
};

const getSpecialtyFromName = (providerName: string): string => {
  // Basic heuristics based on common provider names
  const name = providerName.toLowerCase();
  if (name.includes('dr.') || name.includes('doctor')) {
    return 'Physician';
  }
  if (name.includes('nurse') || name.includes('rn')) {
    return 'Nursing';
  }
  if (name.includes('tech') || name.includes('technician')) {
    return 'Technical';
  }
  return 'General Practice';
};

const getProviderTypeFromCode = (code: string): string => {
  switch (code) {
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