const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export type UserRole = 'admin' | 'physician';

export interface ApiUser {
  username: string;
  role: UserRole;
  providerId?: string | null;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  providerId?: string;
}

export interface UpdateUserInput {
  password?: string;
  role?: UserRole;
  providerId?: string;
}

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let errText: any;
    try { errText = await res.json(); } catch { errText = await res.text(); }
    throw new Error(typeof errText === 'string' ? errText : errText?.error || 'Request failed');
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export const api = {
  login: async (username: string, password: string): Promise<ApiUser> => {
    return request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
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
};
