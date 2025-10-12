import * as XLSX from 'xlsx';

// Types
export interface ShiftCount {
  doctor: string;
  MD1: number;
  MD1_Weekday: number;
  MD1_Weekend: number;
  MD2: number;
  MD2_Weekday: number;
  MD2_Weekend: number;
  PM: number;
  PM_Weekday: number;
  PM_Weekend: number;
  Total_Shifts: number;
  Total_Weekend_Shifts: number;
}

export interface VolumeData {
  doctor: string;
  MD1_Volume: number;
  MD2_Volume: number;
  PM_Volume: number;
  Total_Volume: number;
  NC_Shifts_MD1: number;
  NC_Shifts_MD2: number;
  NC_Shifts_PM: number;
}

export interface ContractLimit {
  provider_name: string;
  contract_type: string;
  shift_preferences: string[];
  total_shift_count: number;
  weekend_shift_count: number;
  pm_shift_count: number;
  MD1_limit: number;
  MD2_limit: number;
  PM_limit: number;
}

export interface ComplianceReport {
  provider_name: string;
  contract_type: string;
  shift_preferences: string;
  MD1_Actual: number;
  MD1_Remaining: string | number;
  MD2_Actual: number;
  MD2_Remaining: string | number;
  PM_Actual: number;
  PM_Limit: string | number;
  PM_Remaining: string | number;
  Total_Actual: number;
  Total_Limit: number | string;
  Total_Remaining: number | string;
  Weekend_Actual: number;
  Weekend_Limit: number | string;
  Weekend_Remaining: number | string;
}

export interface ReplacementProvider {
  rank: number;
  provider_name: string;
  shift_preferences: string;
  volume: number;
}

// Helper: Determine weekend days in a month/year
export function getWeekendDays(year: number, month: number): number[] {
  const weekends: number[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekends.push(day);
    }
  }
  
  return weekends;
}

// Parse schedule Excel file and count shifts
export async function analyzeShiftCounts(filePath: string): Promise<ShiftCount[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  const weekendDays = getWeekendDays(2025, 9);

  const shiftCounts: Map<string, ShiftCount> = new Map();

  const firstRow: any = data[0];
  const shiftColumns = Object.keys(firstRow).filter(col => col !== 'Day');

  data.forEach((row: any, dayIndex: number) => {
    const dayNum = dayIndex + 1;
    const isWeekend = weekendDays.includes(dayNum);

    const dailyShifts: Map<string, Set<string>> = new Map([
      ['MD1', new Set()],
      ['MD2', new Set()],
      ['PM', new Set()],
      ['Other', new Set()]
    ]);

    shiftColumns.forEach(column => {
      let shiftType = 'Other';
      if (column.includes('MD1')) shiftType = 'MD1';
      else if (column.includes('MD2')) shiftType = 'MD2';
      else if (column.includes('PM')) shiftType = 'PM';

      const doctorCell = row[column];
      if (doctorCell && typeof doctorCell === 'string') {
        const doctors = doctorCell.split(',').map(d => d.trim()).filter(d => d);
        doctors.forEach(doctor => {
          dailyShifts.get(shiftType)?.add(doctor);
        });
      }
    });

    dailyShifts.forEach((doctors, shiftType) => {
      doctors.forEach(doctor => {
        if (!shiftCounts.has(doctor)) {
          shiftCounts.set(doctor, {
            doctor,
            MD1: 0, MD1_Weekday: 0, MD1_Weekend: 0,
            MD2: 0, MD2_Weekday: 0, MD2_Weekend: 0,
            PM: 0, PM_Weekday: 0, PM_Weekend: 0,
            Total_Shifts: 0,
            Total_Weekend_Shifts: 0
          });
        }

        const count = shiftCounts.get(doctor)!;
        if (isWeekend) {
          if (shiftType === 'MD1') count.MD1_Weekend++;
          else if (shiftType === 'MD2') count.MD2_Weekend++;
          else if (shiftType === 'PM') count.PM_Weekend++;
        } else {
          if (shiftType === 'MD1') count.MD1_Weekday++;
          else if (shiftType === 'MD2') count.MD2_Weekday++;
          else if (shiftType === 'PM') count.PM_Weekday++;
        }
      });
    });
  });

  const results: ShiftCount[] = [];
  shiftCounts.forEach(count => {
    count.MD1 = count.MD1_Weekday + count.MD1_Weekend;
    count.MD2 = count.MD2_Weekday + count.MD2_Weekend;
    count.PM = count.PM_Weekday + count.PM_Weekend;
    count.Total_Weekend_Shifts = count.MD1_Weekend + count.MD2_Weekend + count.PM_Weekend;
    count.Total_Shifts = count.MD1 + count.MD2 + count.PM;
    results.push(count);
  });

  return results.sort((a, b) => b.Total_Shifts - a.Total_Shifts);
}

// Parse facility volume file
export function parseFacilityVolume(filePath: string): Map<string, { MD1: number | null; MD2: number | null; PM: number | null }> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: ['facility_name', 'Volume_MD1', 'Volume_MD2', 'Volume_PM'] });

  const volumeMap = new Map();

  data.slice(2).forEach((row: any) => {
    const facility = row.facility_name?.trim();
    if (!facility) return;

    const parsedRow = {
      MD1: row.Volume_MD1 === 'NC' ? null : parseFloat(row.Volume_MD1) || null,
      MD2: row.Volume_MD2 === 'NC' ? null : parseFloat(row.Volume_MD2) || null,
      PM: row.Volume_PM === 'NC' ? null : parseFloat(row.Volume_PM) || null
    };

    volumeMap.set(facility, parsedRow);
  });

  return volumeMap;
}

// Calculate volume per doctor
export async function calculateDoctorVolumes(
  scheduleFilePath: string,
  volumeFilePath: string
): Promise<VolumeData[]> {
  const workbook = XLSX.readFile(scheduleFilePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  const volumeDict = parseFacilityVolume(volumeFilePath);
  const doctorVolumes = new Map<string, VolumeData>();

  const firstRow: any = data[0];
  const shiftColumns = Object.keys(firstRow).filter(col => col !== 'Day');

  data.forEach((row: any, dayIndex: number) => {
    const dayNum = dayIndex + 1;
    const dailyShifts = new Map<string, { facility: string; shift_type: string }>();

    shiftColumns.forEach(column => {
      const match = column.match(/(.+?)[\s-]+(MD1|MD2|PM)$/);
      if (!match) return;

      const facility = match[1].trim();
      const shiftType = match[2].trim();

      const doctorCell = row[column];
      if (doctorCell && typeof doctorCell === 'string') {
        const doctors = doctorCell.split(',').map(d => d.trim()).filter(d => d);
        doctors.forEach(doctor => {
          const key = `${doctor}-${shiftType}-${dayNum}`;
          if (!dailyShifts.has(key)) {
            dailyShifts.set(key, { facility, shift_type: shiftType });
          }
        });
      }
    });

    dailyShifts.forEach((info, key) => {
      const doctor = key.split('-')[0];
      const shiftType = info.shift_type;
      const facility = info.facility;

      if (!doctorVolumes.has(doctor)) {
        doctorVolumes.set(doctor, {
          doctor,
          MD1_Volume: 0, MD2_Volume: 0, PM_Volume: 0, Total_Volume: 0,
          NC_Shifts_MD1: 0, NC_Shifts_MD2: 0, NC_Shifts_PM: 0
        });
      }

      const vol = doctorVolumes.get(doctor)!;
      const facilityVol = volumeDict.get(facility);

      if (facilityVol) {
        const volume = facilityVol[shiftType as 'MD1' | 'MD2' | 'PM'];
        if (volume !== null) {
          if (shiftType === 'MD1') vol.MD1_Volume += volume;
          else if (shiftType === 'MD2') vol.MD2_Volume += volume;
          else if (shiftType === 'PM') vol.PM_Volume += volume;
          vol.Total_Volume += volume;
        } else {
          if (shiftType === 'MD1') vol.NC_Shifts_MD1++;
          else if (shiftType === 'MD2') vol.NC_Shifts_MD2++;
          else if (shiftType === 'PM') vol.NC_Shifts_PM++;
        }
      } else {
        if (shiftType === 'MD1') vol.NC_Shifts_MD1++;
        else if (shiftType === 'MD2') vol.NC_Shifts_MD2++;
        else if (shiftType === 'PM') vol.NC_Shifts_PM++;
      }
    });
  });

  const results = Array.from(doctorVolumes.values());
  return results.sort((a, b) => b.Total_Volume - a.Total_Volume);
}

// Parse contract limits
export function parseContractLimits(filePath: string): Map<string, ContractLimit> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: ['Provider_Name', 'Contract_type', 'Shift_preference', 'Total_shift_count', 'Weekend_shift_count', 'PM_shift_count']
  });

  const contractMap = new Map<string, ContractLimit>();

  data.slice(2).forEach((row: any) => {
    const provider = row.Provider_Name?.trim();
    if (!provider) return;

    const shiftPrefs = row.Shift_preference?.split(',').map((s: string) => s.trim()) || [];

    contractMap.set(provider, {
      provider_name: provider,
      contract_type: row.Contract_type?.trim() || '',
      shift_preferences: shiftPrefs,
      total_shift_count: parseInt(row.Total_shift_count) || 0,
      weekend_shift_count: parseInt(row.Weekend_shift_count) || 0,
      pm_shift_count: parseInt(row.PM_shift_count) || 0,
      MD1_limit: shiftPrefs.includes('MD1') ? Infinity : 0,
      MD2_limit: shiftPrefs.includes('MD2') ? Infinity : 0,
      PM_limit: shiftPrefs.includes('PM') ? parseInt(row.PM_shift_count) || 0 : 0
    });
  });

  return contractMap;
}

// Generate compliance report
export async function generateComplianceReport(
  shiftCounts: ShiftCount[],
  contractLimits: Map<string, ContractLimit>
): Promise<ComplianceReport[]> {
  const reports: ComplianceReport[] = [];

  shiftCounts.forEach(count => {
    const limit = contractLimits.get(count.doctor);

    if (limit) {
      const totalDiff = limit.total_shift_count - count.Total_Shifts;
      const weekendDiff = limit.weekend_shift_count - count.Total_Weekend_Shifts;
      const pmDiff = limit.PM_limit !== Infinity ? limit.PM_limit - count.PM : null;

      reports.push({
        provider_name: count.doctor,
        contract_type: limit.contract_type,
        shift_preferences: limit.shift_preferences.join(', '),
        MD1_Actual: count.MD1,
        MD1_Remaining: limit.shift_preferences.includes('MD1') ? 'Allowed' : -count.MD1,
        MD2_Actual: count.MD2,
        MD2_Remaining: limit.shift_preferences.includes('MD2') ? 'Allowed' : -count.MD2,
        PM_Actual: count.PM,
        PM_Limit: limit.PM_limit !== Infinity ? limit.PM_limit : 'N/A',
        PM_Remaining: pmDiff !== null ? pmDiff : 'N/A',
        Total_Actual: count.Total_Shifts,
        Total_Limit: limit.total_shift_count,
        Total_Remaining: totalDiff,
        Weekend_Actual: count.Total_Weekend_Shifts,
        Weekend_Limit: limit.weekend_shift_count,
        Weekend_Remaining: weekendDiff
      });
    } else {
      reports.push({
        provider_name: count.doctor,
        contract_type: 'Not in contract file',
        shift_preferences: 'N/A',
        MD1_Actual: count.MD1,
        MD1_Remaining: 'No limit',
        MD2_Actual: count.MD2,
        MD2_Remaining: 'No limit',
        PM_Actual: count.PM,
        PM_Limit: 'N/A',
        PM_Remaining: 'N/A',
        Total_Actual: count.Total_Shifts,
        Total_Limit: 'N/A',
        Total_Remaining: 'N/A',
        Weekend_Actual: count.Total_Weekend_Shifts,
        Weekend_Limit: 'N/A',
        Weekend_Remaining: 'N/A'
      });
    }
  });

  return reports;
}

// Parse credentialing file
export function parseCredentialing(filePath: string): Map<string, string[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  const credentialMap = new Map<string, string[]>();

  data.forEach((row: any) => {
    const provider = row['Provider']?.trim();
    const facilities = row['Credentialed Facilities'];

    if (provider && facilities) {
      const facilityList = facilities.split(',').map((f: string) => f.trim());
      credentialMap.set(provider, facilityList);
    }
  });

  return credentialMap;
}

// Find replacement providers
export async function findReplacementProviders(
  credentialingFilePath: string,
  complianceReport: ComplianceReport[],
  volumeData: VolumeData[],
  facilityCode: string,
  shiftType: 'MD1' | 'MD2' | 'PM',
  cancelDate: Date
): Promise<ReplacementProvider[]> {
  const isWeekend = cancelDate.getDay() === 0 || cancelDate.getDay() === 6;

  const credentialMap = parseCredentialing(credentialingFilePath);
  const credentialedProviders: string[] = [];

  credentialMap.forEach((facilities, provider) => {
    if (facilities.includes(facilityCode)) {
      credentialedProviders.push(provider);
    }
  });

  const availableProviders = complianceReport.filter(report => {
    if (!credentialedProviders.includes(report.provider_name)) return false;

    if (isWeekend) {
      const remaining = report.Weekend_Remaining;
      return typeof remaining === 'number' ? remaining > 0 : remaining === 'Allowed' || remaining === 'No limit';
    } else {
      const remaining = report[`${shiftType}_Remaining` as keyof ComplianceReport];
      return typeof remaining === 'number' ? remaining > 0 : remaining === 'Allowed' || remaining === 'No limit';
    }
  });

  const results: ReplacementProvider[] = availableProviders.map(provider => {
    const volumeInfo = volumeData.find(v => v.doctor === provider.provider_name);
    const volume = volumeInfo ? volumeInfo[`${shiftType}_Volume`] : Infinity;

    return {
      rank: 0,
      provider_name: provider.provider_name,
      shift_preferences: provider.shift_preferences,
      volume
    };
  });

  results.sort((a, b) => a.volume - b.volume);
  results.forEach((r, i) => r.rank = i + 1);

  return results;
}

export async function analyzeConsecutiveShifts(
  scheduleFilePath: string,
  providerName: string
): Promise<{
  maxConsecutive: number;
  consecutiveGroups: Array<{ startDate: string; endDate: string; count: number }>;
  totalDays: number;
  workDays: number;
}> {
  const workbook = XLSX.readFile(scheduleFilePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  const firstRow: any = data[0];
  const shiftColumns = Object.keys(firstRow).filter(col => col !== 'Day');

  // Track which days the provider worked
  const workingDays = new Set<number>();

  data.forEach((row: any, dayIndex: number) => {
    const dayNum = dayIndex + 1;
    
    shiftColumns.forEach(column => {
      const doctorCell = row[column];
      if (doctorCell && typeof doctorCell === 'string') {
        const doctors = doctorCell.split(',').map(d => d.trim());
        if (doctors.includes(providerName)) {
          workingDays.add(dayNum);
        }
      }
    });
  });

  // Find consecutive working days
  const sortedDays = Array.from(workingDays).sort((a, b) => a - b);
  const consecutiveGroups: Array<{ startDate: string; endDate: string; count: number }> = [];
  
  let currentGroup: number[] = [];
  let maxConsecutive = 0;

  sortedDays.forEach((day, index) => {
    if (currentGroup.length === 0 || day === sortedDays[index - 1] + 1) {
      currentGroup.push(day);
    } else {
      if (currentGroup.length >= 2) {
        consecutiveGroups.push({
          startDate: `Oct ${currentGroup[0]}`,
          endDate: `Oct ${currentGroup[currentGroup.length - 1]}`,
          count: currentGroup.length
        });
        maxConsecutive = Math.max(maxConsecutive, currentGroup.length);
      }
      currentGroup = [day];
    }
  });

  // Handle last group
  if (currentGroup.length >= 2) {
    consecutiveGroups.push({
      startDate: `Oct ${currentGroup[0]}`,
      endDate: `Oct ${currentGroup[currentGroup.length - 1]}`,
      count: currentGroup.length
    });
    maxConsecutive = Math.max(maxConsecutive, currentGroup.length);
  }

  return {
    maxConsecutive,
    consecutiveGroups,
    totalDays: data.length,
    workDays: sortedDays.length
  };
}

// Calculate satisfaction score
export function calculateSatisfactionScore(
  shiftCount: ShiftCount,
  volumeData: VolumeData,
  compliance: ComplianceReport,
  consecutiveData: { maxConsecutive: number; workDays: number; totalDays: number },
  happinessRating: number | null
): {
  overallScore: number;
  breakdown: {
    workloadBalance: { score: number; weight: number; weighted: number };
    weekendBurden: { score: number; weight: number; weighted: number };
    consecutiveShifts: { score: number; weight: number; weighted: number };
    contractCompliance: { score: number; weight: number; weighted: number };
    selfReported: { score: number; weight: number; weighted: number };
  };
} {
  // 1. Workload Balance (30%) - Lower is better, based on total shifts relative to a "normal" workload
  const idealShifts = 15; // Ideal monthly shifts
  const workloadDiff = Math.abs(shiftCount.Total_Shifts - idealShifts);
  const workloadBalanceScore = Math.max(0, 10 - (workloadDiff / idealShifts) * 10);

  // 2. Weekend Burden (20%) - Lower weekend ratio is better
  const weekendRatio = shiftCount.Total_Weekend_Shifts / Math.max(1, shiftCount.Total_Shifts);
  const idealWeekendRatio = 0.25; // 25% weekends is ideal
  const weekendDiff = Math.abs(weekendRatio - idealWeekendRatio);
  const weekendBurdenScore = Math.max(0, 10 - (weekendDiff * 40));

  // 3. Consecutive Shifts (25%) - Fewer consecutive days is better
  const maxConsecutive = consecutiveData.maxConsecutive;
  let consecutiveScore = 10;
  if (maxConsecutive >= 7) consecutiveScore = 2;
  else if (maxConsecutive >= 6) consecutiveScore = 4;
  else if (maxConsecutive >= 5) consecutiveScore = 6;
  else if (maxConsecutive >= 4) consecutiveScore = 8;
  else if (maxConsecutive >= 3) consecutiveScore = 9;

  // 4. Contract Compliance (15%) - Staying within limits
  let complianceScore = 10;
  const totalRemaining = compliance.Total_Remaining;
  const weekendRemaining = compliance.Weekend_Remaining;
  
  if (typeof totalRemaining === 'number' && totalRemaining < 0) {
    complianceScore -= Math.abs(totalRemaining) * 2;
  }
  if (typeof weekendRemaining === 'number' && weekendRemaining < 0) {
    complianceScore -= Math.abs(weekendRemaining) * 2;
  }
  complianceScore = Math.max(0, Math.min(10, complianceScore));

  // 5. Self-Reported Happiness (10%)
  const selfReportedScore = happinessRating || 5; // Default to 5 if not provided

  // Weights
  const weights = {
    workloadBalance: 0.40,
    weekendBurden: 0.20,
    consecutiveShifts: 0.20,
    contractCompliance: 0.15,
    selfReported: 0.05
  };

  // Calculate weighted scores
  const breakdown = {
    workloadBalance: {
      score: Number(workloadBalanceScore.toFixed(1)),
      weight: weights.workloadBalance,
      weighted: Number((workloadBalanceScore * weights.workloadBalance).toFixed(2))
    },
    weekendBurden: {
      score: Number(weekendBurdenScore.toFixed(1)),
      weight: weights.weekendBurden,
      weighted: Number((weekendBurdenScore * weights.weekendBurden).toFixed(2))
    },
    consecutiveShifts: {
      score: consecutiveScore,
      weight: weights.consecutiveShifts,
      weighted: Number((consecutiveScore * weights.consecutiveShifts).toFixed(2))
    },
    contractCompliance: {
      score: Number(complianceScore.toFixed(1)),
      weight: weights.contractCompliance,
      weighted: Number((complianceScore * weights.contractCompliance).toFixed(2))
    },
    selfReported: {
      score: selfReportedScore,
      weight: weights.selfReported,
      weighted: Number((selfReportedScore * weights.selfReported).toFixed(2))
    }
  };

  const overallScore = Number((
    breakdown.workloadBalance.weighted +
    breakdown.weekendBurden.weighted +
    breakdown.consecutiveShifts.weighted +
    breakdown.contractCompliance.weighted +
    breakdown.selfReported.weighted
  ).toFixed(1));

  return { overallScore, breakdown };
}