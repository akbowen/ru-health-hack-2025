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