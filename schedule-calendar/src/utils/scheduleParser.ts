import * as XLSX from 'xlsx';
import { ScheduleData, Provider, Site, ScheduleEntry } from '../types/schedule';

export const parseScheduleExcel = async (file: File): Promise<ScheduleData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to array format to handle the complex structure
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        const scheduleData = parseComplexScheduleData(rawData);
        resolve(scheduleData);
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
  
  if (rawData.length < 3) {
    throw new Error('Invalid schedule format - need at least 3 rows');
  }
  
  // Skip row 0 (description), parse facility assignments from row 1
  const facilityRow = rawData[1];
  const facilitiesData: Array<{ facilityGroup: string; sites: string[] }> = [];
  
  if (!facilityRow || facilityRow.length < 3) {
    throw new Error('Invalid facility row format');
  }
  
  // Start from column 2 (skip day and number columns)
  for (let colIndex = 2; colIndex < facilityRow.length; colIndex++) {
    const cellValue = facilityRow[colIndex];
    if (cellValue && typeof cellValue === 'string') {
      const parts = cellValue.split(' - ');
      if (parts.length >= 2) {
        const providerType = parts[0].trim(); // MD1, MD2, PM
        const sitesStr = parts[1].trim();
        const sitesList = sitesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        facilitiesData.push({
          facilityGroup: providerType, // Just use MD1, MD2, PM without column reference
          sites: sitesList
        });
        
        // Create sites
        sitesList.forEach(siteName => {
          if (!siteMap.has(siteName)) {
            const site: Site = {
              id: `site-${sites.length + 1}`,
              name: siteName,
              type: getProviderTypeFromCode(providerType)
            };
            sites.push(site);
            siteMap.set(siteName, site);
          }
        });
      }
    }
  }
  
  // Parse daily schedules from row 2 onwards
  for (let rowIndex = 2; rowIndex < rawData.length; rowIndex++) {
    const row = rawData[rowIndex];
    if (!row || row.length < 3) continue;
    
    const dayOfWeek = row[0];
    const dayNumber = row[1];
    
    if (!dayOfWeek || typeof dayNumber !== 'number') continue;
    
  // Use the number in column B as the day of the month for October 2025
  const scheduleDate = new Date(2025, 9, dayNumber);
    
    // Process each column (facility assignment)
    for (let colIndex = 2; colIndex < row.length && colIndex - 2 < facilitiesData.length; colIndex++) {
      const providerName = row[colIndex];
      if (!providerName || typeof providerName !== 'string') continue;
      
      // Clean provider name (remove gaps, extra spaces)
      const cleanProviderName = providerName.replace(/\s*\(Gap\)\s*/i, '').trim();
      if (!cleanProviderName) continue;
      
      // Create or get provider
      if (!providerMap.has(cleanProviderName)) {
        const provider: Provider = {
          id: `provider-${providers.length + 1}`,
          name: cleanProviderName,
          specialty: getSpecialtyFromName(cleanProviderName)
        };
        providers.push(provider);
        providerMap.set(cleanProviderName, provider);
      }
      
      const provider = providerMap.get(cleanProviderName)!;
      const facilityInfo = facilitiesData[colIndex - 2];
      
      // Create schedule entries for each site in this facility group
      facilityInfo.sites.forEach(siteName => {
        const site = siteMap.get(siteName);
        if (site) {
          const schedule: ScheduleEntry = {
            id: `schedule-${schedules.length + 1}`,
            providerId: provider.id,
            siteId: site.id,
            date: new Date(scheduleDate),
            startTime: facilityInfo.facilityGroup, // Use the actual shift name (MD1, MD2, PM, etc.)
            endTime: '', // No end time since we don't have that data
            status: 'scheduled',
            notes: providerName.includes('(Gap)') ? 'Gap coverage' : undefined
          };
          schedules.push(schedule);
        }
      });
    }
  }
  
  return { providers, sites, schedules };
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