// Types for the schedule application
export interface Provider {
  id: string;
  name: string;
  specialty?: string;
  email?: string;
}

export interface Site {
  id: string;
  name: string;
  address?: string;
  type?: string;
}

export interface ScheduleEntry {
  id: string;
  providerId: string;
  siteId: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled';
  notes?: string;
}

export interface CalendarView {
  type: 'month' | 'week' | 'day';
  date: Date;
  filteredBy?: {
    provider?: Provider;
    site?: Site;
  };
}

export interface ScheduleData {
  providers: Provider[];
  sites: Site[];
  schedules: ScheduleEntry[];
}

// Add these interfaces to your existing schedule.ts file in the frontend
// Location: frontend/src/types/schedule.ts (or wherever your schedule.ts is)

export interface LeaveRequest {
  id: string;
  physicianId: string;
  physicianName: string;
  date: string; // YYYY-MM-DD
  shiftType: string; // MD1, MD2, PM
  siteId: string;
  siteName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: string;
}

export interface AvailabilityAlert {
  id: string;
  siteId: string;
  siteName: string;
  date: string;
  shiftType: string;
  originalPhysicianName: string;
  createdAt: string;
  status: 'open' | 'filled';
  filledBy?: string;
  filledByName?: string;
}