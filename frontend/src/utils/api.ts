const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export type UserRole = 'admin' | 'physician' | 'hospital';

export interface ConsecutiveShiftsData {
  maxConsecutive: number;
  consecutiveGroups: Array<{ startDate: string; endDate: string; count: number }>;
  totalDays: number;
  workDays: number;
}

export interface SatisfactionBreakdown {
  workloadBalance: { score: number; weight: number; weighted: number };
  weekendBurden: { score: number; weight: number; weighted: number };
  consecutiveShifts: { score: number; weight: number; weighted: number };
  contractCompliance: { score: number; weight: number; weighted: number };
  selfReported: { score: number; weight: number; weighted: number };
}

export interface SatisfactionData {
  providerName: string;
  consecutiveData: ConsecutiveShiftsData;
  satisfaction: {
    overallScore: number;
    breakdown: SatisfactionBreakdown;
  };
  happinessRating: number | null;
  feedback: string | null;
}

export interface ApiUser {
  username: string;
  role: UserRole;
  providerId?: string | null;
  siteId?: string | null;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  providerId?: string;
  siteId?: string;
}

export interface UpdateUserInput {
  password?: string;
  role?: UserRole;
  providerId?: string;
  siteId?: string;
}

// Analytics types
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

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  
  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  
  if (!res.ok) {
    let errText: any;
    try { 
      if (isJson) {
        errText = await res.json();
      } else {
        errText = await res.text();
      }
    } catch {
      errText = 'Request failed';
    }
    throw new Error(typeof errText === 'string' ? errText : errText?.error || 'Request failed');
  }
  
  if (isJson) {
    return res.json();
  }
  return res.text();
}

export const api = {
  // Auth
  login: async (username: string, password: string): Promise<ApiUser> => {
    return request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  // Users
  getUsers: async (): Promise<ApiUser[]> => request('/api/users'),
  createUser: async (user: CreateUserInput): Promise<{ ok: true }> =>
    request('/api/users', { method: 'POST', body: JSON.stringify(user) }),
  updateUser: async (username: string, update: UpdateUserInput): Promise<{ ok: true }> =>
    request(`/api/users/${encodeURIComponent(username)}`, { method: 'PUT', body: JSON.stringify(update) }),
  deleteUser: async (username: string): Promise<{ ok: true }> =>
    request(`/api/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),

  // Schedule data GET endpoints
  getProviders: async (): Promise<Array<{ id: string; name: string }>> => 
    request('/api/providers'),
  getSites: async (): Promise<Array<{ id: string; name: string }>> => 
    request('/api/sites'),
  getSchedules: async (): Promise<Array<{ id: string; providerId: string; siteId: string; date: string; startTime: string; endTime: string; status: string; notes?: string }>> => 
    request('/api/schedules'),

  // Bulk upload endpoints
  bulkProviders: async (rows: Array<{ id: string; name: string }>) =>
    request('/api/providers/bulk', { method: 'POST', body: JSON.stringify(rows) }),
  bulkSites: async (rows: Array<{ id: string; name: string }>) =>
    request('/api/sites/bulk', { method: 'POST', body: JSON.stringify(rows) }),
  bulkSchedules: async (rows: Array<{ id: string; providerId: string; siteId: string; date: string; startTime: string; endTime: string; status: string; notes?: string }>) =>
    request('/api/schedules/bulk', { method: 'POST', body: JSON.stringify(rows) }),
  resetSchedule: async (): Promise<{ ok: true }> =>
    request('/api/schedule/reset', { method: 'POST' }),

  // Analytics endpoints
  getShiftCounts: async (): Promise<ShiftCount[]> => 
    request('/api/analysis/shift-counts'),
  
  getVolumes: async (): Promise<VolumeData[]> => 
    request('/api/analysis/volumes'),
  
  getCompliance: async (): Promise<ComplianceReport[]> => 
    request('/api/analysis/compliance'),
  
  findReplacements: async (facilityCode: string, shiftType: 'MD1' | 'MD2' | 'PM', cancelDate: string): Promise<ReplacementProvider[]> =>
    request('/api/analysis/find-replacements', {
      method: 'POST',
      body: JSON.stringify({ facilityCode, shiftType, cancelDate })
    }),
  
  uploadAnalysisFiles: async (files: {
    scheduleFile?: File;
    volumeFile?: File;
    contractFile?: File;
    credentialingFile?: File;
  }): Promise<{ ok: true; message: string }> => {
    const formData = new FormData();
    if (files.scheduleFile) formData.append('scheduleFile', files.scheduleFile);
    if (files.volumeFile) formData.append('volumeFile', files.volumeFile);
    if (files.contractFile) formData.append('contractFile', files.contractFile);
    if (files.credentialingFile) formData.append('credentialingFile', files.credentialingFile);
    
    const res = await fetch(`${BASE_URL}/api/analysis/upload-files`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      let error: any;
      try {
        error = await res.json();
      } catch {
        error = await res.text();
      }
      throw new Error(typeof error === 'string' ? error : error?.error || 'Upload failed');
    }
    
    return res.json();
  },

  // Satisfaction endpoints
  getSatisfaction: async (username: string): Promise<SatisfactionData> =>
    request(`/api/analysis/satisfaction/${encodeURIComponent(username)}`),
  
  updateHappinessRating: async (username: string, rating: number, feedback?: string): Promise<{ ok: true }> =>
    request('/api/physician-satisfaction', {
      method: 'POST',
      body: JSON.stringify({ username, happiness_rating: rating, feedback })
    })
};
