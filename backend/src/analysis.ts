import * as XLSX from 'xlsx';
import { da } from 'zod/v4/locales';

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
type Cell = string | number | null | undefined;
type Row = Cell[];

export async function analyzeShiftCounts(filePath: string): Promise<ShiftCount[]> {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // Read as a 2D array; skip top metadata rows; fill blanks with ''
  const raw = XLSX.utils.sheet_to_json<Row>(sheet, {
    header: 1,      // 2D array (no inferred object keys)
    range: 6,       // start at the row where headers actually begin
    blankrows: false,
    defval: ""      // make empty cells be '' (not undefined)
  }) as Row[];

  if (!raw.length) return [];

  // Row 0 are headers; coerce to strings
  const headers: string[] = (raw[0] ?? []).map(h => String(h ?? "").trim());
  const rows: Row[] = raw.slice(1);

  // Precompute which columns are shift columns + their shift types
  const shiftCols = headers
    .map((h, i) => ({ header: h, idx: i }))
    .filter(({ header }) => /(?:^|[\s-])(?:MD1|MD2|PM)(?:$|[\s-])/i.test(header)) // match 'AHG - MD1', '... PM', etc.
    .map(({ header, idx }) => {
      let t: "MD1" | "MD2" | "PM" | "Other" = "Other";
      const H = header.toUpperCase();
      if (H.includes("MD1")) t = "MD1";
      else if (H.includes("MD2")) t = "MD2";
      else if (/\bPM\b/.test(H)) t = "PM";
      return { idx, shiftType: t as "MD1" | "MD2" | "PM" };
    });

  const weekendDays = getWeekendDays(2025, 9);
  const shiftCounts: Map<string, ShiftCount> = new Map();

  rows.forEach((row, rowIndex) => {
    const dayNum = rowIndex + 1;
    const isWeekend = weekendDays.includes(dayNum);

    // unique doctors per shift per day
    const seen = {
      MD1: new Set<string>(),
      MD2: new Set<string>(),
      PM: new Set<string>(),
    };

    for (const { idx, shiftType } of shiftCols) {
      const cell = row[idx];
      // Safely coerce to string and trim
      const doctor = typeof cell === "string" ? cell.trim() : String(cell ?? "").trim();

      if (!doctor || doctor.toUpperCase() === "UNCOVERED") continue;

      // If a cell had multiple comma-separated doctors (rare), split them
      const names = doctor.split(",").map(s => s.trim()).filter(Boolean);
      for (const name of names) seen[shiftType].add(name);
    }

    // accumulate counts
    (Object.keys(seen) as Array<keyof typeof seen>).forEach((shiftType) => {
      for (const doctor of seen[shiftType]) {
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
        const c = shiftCounts.get(doctor)!;
        if (shiftType === "MD1") isWeekend ? c.MD1_Weekend++ : c.MD1_Weekday++;
        if (shiftType === "MD2") isWeekend ? c.MD2_Weekend++ : c.MD2_Weekday++;
        if (shiftType === "PM")  isWeekend ? c.PM_Weekend++  : c.PM_Weekday++;
      }
    });
  });

  // finalize totals
  const results: ShiftCount[] = [];
  for (const c of shiftCounts.values()) {
    c.MD1 = c.MD1_Weekday + c.MD1_Weekend;
    c.MD2 = c.MD2_Weekday + c.MD2_Weekend;
    c.PM  = c.PM_Weekday  + c.PM_Weekend;
    c.Total_Weekend_Shifts = c.MD1_Weekend + c.MD2_Weekend + c.PM_Weekend;
    c.Total_Shifts = c.MD1 + c.MD2 + c.PM;
    results.push(c);
  }

  return results.sort((a, b) => b.Total_Shifts - a.Total_Shifts);
}

// Parse facility volume file
export function parseFacilityVolume(
  filePath: string
): Map<string, { MD1: number | null; MD2: number | null; PM: number | null }> {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // Row 3 in your screenshot is the header; use explicit headers and start at that row
  type Row = {
    facility_name: any;
    "Volume MD1": any;
    "Volume MD2": any;
    "Volume PM": any;
  };

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
    range: 2, // <-- start at Excel row 3
    header: ["facility_name", "Volume MD1", "Volume MD2", "Volume PM"],
    defval: "" // keep empty cells as empty strings
  });

  const normText = (s: any) =>
    String(s ?? "")
      .replace(/\u00A0/g, " ")  // non-breaking space -> normal space
      .replace(/\t/g, " ")
      .trim();

  const toNumOrNull = (v: any): number | null => {
    const raw = normText(v);
    if (!raw) return null;
    if (/^nc$/i.test(raw)) return null;
    // strip any stray characters and parse
    const n = parseFloat(raw.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const volumeMap = new Map<string, { MD1: number | null; MD2: number | null; PM: number | null }>();

  for (const r of rows) {
    const fac = normText(r.facility_name).toUpperCase();
    if (!fac) continue;

    const md1 = toNumOrNull((r as any)["Volume MD1"]);
    const md2 = toNumOrNull((r as any)["Volume MD2"]);
    const pm  = toNumOrNull((r as any)["Volume PM"]);

    volumeMap.set(fac, { MD1: md1, MD2: md2, PM: pm });
  }

  // Optional: quick sanity check
  if (volumeMap.size === 0) {
    console.warn("[parseFacilityVolume] No rows parsed. Check sheet name/range/headers.");
  } else {
    const sample = Array.from(volumeMap.keys()).slice(0, 5);
    console.log("[parseFacilityVolume] Loaded facilities:", sample, "… total:", volumeMap.size);
  }

  return volumeMap;
}


function findScheduleHeaderRow(sheet: XLSX.Sheet): number {
  // Scan first ~100 rows looking for a cell "Day" in column A (A1 notation)
  for (let r = 0; r < 200; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })]; // column A = c:0
    const v = (cell?.v ?? "").toString().replace(/\u00A0/g, " ").trim();
    if (/^day$/i.test(v)) return r;
  }
  // Fallback: 0 (but we log so you can see if it failed)
  console.warn("[schedule] Couldn't find 'Day' header; defaulting to row 0");
  return 0;
}

// Calculate volume per doctor
export async function calculateDoctorVolumes(
  scheduleFilePath: string,
  volumeFilePath: string
): Promise<VolumeData[]> {
  const workbook = XLSX.readFile(scheduleFilePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const headerRow = findScheduleHeaderRow(sheet);

  // Parse using the discovered header row
  const data: any[] = XLSX.utils.sheet_to_json(sheet, {
    range: headerRow, // this row is treated as the header
    defval: ""        // keep blanks as ""
  });

  // Safety: if sheet_to_json turned the "Day" header into something else
  const first = data[0] ?? {};
  const keys = Object.keys(first);
  const dayKey = keys.find(k => /^day$/i.test(k)) ?? "Day";

  // All columns except "Day" are facility-shift columns
  const shiftColumns = keys.filter(k => k !== dayKey);

  // DEBUG so we can see what we’re parsing
  // .log("[schedule] headerRow =", headerRow);
  // console.log("[schedule] shiftColumns =", shiftColumns.slice(0, 8), "… total:", shiftColumns.length);

  // If no shift columns, we’ll return [] — but log why
  if (shiftColumns.length === 0) {
    console.warn("[schedule] No shift columns found. Check header row in the XLSX.");
  }

  const volumeDict = parseFacilityVolume(volumeFilePath);
  const doctorVolumes = new Map<string, VolumeData>();

  const normText = (s: any) =>
    String(s ?? "").replace(/\u00A0/g, " ").trim();
  const normFacility = (s: string) => normText(s).toUpperCase();

  data.forEach((row: any, dayIndex: number) => {
    const dayNum = Number(row[dayKey]) || (dayIndex + 1);

    // De-dup (doctor, shift, day)
    const dailySeen = new Set<string>();

    for (const column of shiftColumns) {
      // Matches: "AHG - MD1", "BHDCHV MD2", "ASMC- PM", etc.
      const m = column.match(/(.+?)[\s-]+(MD1|MD2|PM)$/i);
      if (!m) continue;

      const facility = normFacility(m[1]);
      const shiftType = m[2].toUpperCase() as "MD1" | "MD2" | "PM";

      const cell = row[column];
      if (!cell) continue;

      // Split by comma OR newline
      const doctors = String(cell)
        .split(/[,\n]+/)
        .map(s => normText(s))
        .filter(Boolean);

      for (const doctor of doctors) {
        const key = `${doctor}||${shiftType}||${dayNum}`;
        if (dailySeen.has(key)) continue;
        dailySeen.add(key);

        if (!doctorVolumes.has(doctor)) {
          doctorVolumes.set(doctor, {
            doctor,
            MD1_Volume: 0, MD2_Volume: 0, PM_Volume: 0, Total_Volume: 0,
            NC_Shifts_MD1: 0, NC_Shifts_MD2: 0, NC_Shifts_PM: 0
          });
        }

        const volRow = volumeDict.get(facility);
        const agg = doctorVolumes.get(doctor)!;

        if (volRow) {
          const v = volRow[shiftType];
          if (v != null) {
            if (shiftType === "MD1") agg.MD1_Volume += v;
            else if (shiftType === "MD2") agg.MD2_Volume += v;
            else agg.PM_Volume += v;
            agg.Total_Volume += v;
          } else {
            if (shiftType === "MD1") agg.NC_Shifts_MD1++;
            else if (shiftType === "MD2") agg.NC_Shifts_MD2++;
            else agg.NC_Shifts_PM++;
          }
        } else {
          // Facility not found in volume map -> treat as NC
          if (shiftType === "MD1") agg.NC_Shifts_MD1++;
          else if (shiftType === "MD2") agg.NC_Shifts_MD2++;
          else agg.NC_Shifts_PM++;
        }
      }
    }
  });

  // DEBUG: show a couple of doctors
  const sample = Array.from(doctorVolumes.values()).slice(0, 3);
  // console.log("[volumes] doctors parsed:", doctorVolumes.size, " sample:", sample.map(s => s.doctor));

  const results = Array.from(doctorVolumes.values()).sort((a, b) => b.Total_Volume - a.Total_Volume);
  return results;
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