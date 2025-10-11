import * as XLSX from 'xlsx';
import { ScheduleData, Provider, Site, ScheduleEntry } from '../types/schedule';

export const parseExcelFile = async (file: File): Promise<ScheduleData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Assuming the first sheet contains the schedule data
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const scheduleData = parseScheduleData(jsonData);
        resolve(scheduleData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

const parseScheduleData = (data: any[]): ScheduleData => {
  const providers: Provider[] = [];
  const sites: Site[] = [];
  const schedules: ScheduleEntry[] = [];
  
  const providerMap = new Map<string, Provider>();
  const siteMap = new Map<string, Site>();
  
  data.forEach((row, index) => {
    // Extract provider information
    const providerName = row['Provider'] || row['provider'] || row['Provider Name'];
    if (providerName && !providerMap.has(providerName)) {
      const provider: Provider = {
        id: `provider-${providers.length + 1}`,
        name: providerName,
        specialty: row['Specialty'] || row['specialty']
      };
      providers.push(provider);
      providerMap.set(providerName, provider);
    }
    
    // Extract site information
    const siteName = row['Site'] || row['site'] || row['Facility'] || row['Location'];
    if (siteName && !siteMap.has(siteName)) {
      const site: Site = {
        id: `site-${sites.length + 1}`,
        name: siteName,
        type: row['Site Type'] || row['Type']
      };
      sites.push(site);
      siteMap.set(siteName, site);
    }
    
    // Extract schedule entry
    const date = parseDate(row['Date'] || row['date'] || row['Schedule Date']);
    const startTime = row['Start Time'] || row['start_time'] || row['Start'];
    const endTime = row['End Time'] || row['end_time'] || row['End'];
    
    if (date && startTime && providerName && siteName) {
      const schedule: ScheduleEntry = {
        id: `schedule-${index}`,
        providerId: providerMap.get(providerName)!.id,
        siteId: siteMap.get(siteName)!.id,
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

// Sample data for demonstration
export const getSampleScheduleData = (): ScheduleData => {
  const providers: Provider[] = [
    { id: 'p1', name: 'Dr. Sarah Johnson', specialty: 'Cardiology' },
    { id: 'p2', name: 'Dr. Michael Chen', specialty: 'Orthopedics' },
    { id: 'p3', name: 'Dr. Emily Rodriguez', specialty: 'Pediatrics' },
    { id: 'p4', name: 'Dr. David Thompson', specialty: 'Internal Medicine' }
  ];

  const sites: Site[] = [
    { id: 's1', name: 'Main Hospital', type: 'Hospital' },
    { id: 's2', name: 'Downtown Clinic', type: 'Clinic' },
    { id: 's3', name: 'North Branch', type: 'Clinic' },
    { id: 's4', name: 'Surgical Center', type: 'Surgery Center' }
  ];

  const schedules: ScheduleEntry[] = [
    { id: 'sch1', providerId: 'p1', siteId: 's1', date: new Date(2025, 9, 15), startTime: '09:00', endTime: '17:00', status: 'confirmed' },
    { id: 'sch2', providerId: 'p1', siteId: 's2', date: new Date(2025, 9, 16), startTime: '08:00', endTime: '16:00', status: 'scheduled' },
    { id: 'sch3', providerId: 'p2', siteId: 's3', date: new Date(2025, 9, 15), startTime: '10:00', endTime: '18:00', status: 'confirmed' },
    { id: 'sch4', providerId: 'p2', siteId: 's4', date: new Date(2025, 9, 17), startTime: '07:00', endTime: '15:00', status: 'scheduled' },
    { id: 'sch5', providerId: 'p3', siteId: 's1', date: new Date(2025, 9, 18), startTime: '09:00', endTime: '17:00', status: 'confirmed' },
    { id: 'sch6', providerId: 'p4', siteId: 's2', date: new Date(2025, 9, 19), startTime: '08:30', endTime: '16:30', status: 'scheduled' }
  ];

  return { providers, sites, schedules };
};