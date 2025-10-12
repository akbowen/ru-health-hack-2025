import React, { useMemo, useState } from 'react';
import Calendar from './Calendar';
import { ScheduleData, Provider } from '../types/schedule';
import './PhysicianView.css';

interface PhysicianViewProps {
  provider: Provider;
  scheduleData: ScheduleData;
  onLogout: () => void;
}

// Default goal for shifts per month (for dashboard display)
const MONTHLY_SHIFT_GOAL = 20;

type TabKey = 'dashboard' | 'calendar';

const PhysicianView: React.FC<PhysicianViewProps> = ({ provider, scheduleData, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  // Only this provider's shifts
  const myShifts = useMemo(() => (
    scheduleData.schedules.filter(s => s.providerId === provider.id)
  ), [scheduleData.schedules, provider.id]);

  // Helper: ymd string
  const ymd = (d: Date) => {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
  };

  // Current month shifts
  const now = new Date();
  const thisMonthShifts = useMemo(() => (
    myShifts.filter(s => s.date.getFullYear() === now.getFullYear() && s.date.getMonth() === now.getMonth())
  ), [myShifts, now]);

  // Compute streak: consecutive days ending on the most recent scheduled day up to today
  const currentStreak = useMemo(() => {
    if (myShifts.length === 0) return 0;
    const dates = Array.from(new Set(myShifts.map(s => ymd(s.date)))).sort();
    // Find the most recent date <= today
    const todayStr = ymd(now);
    const pastOrToday = dates.filter(d => d <= todayStr);
    if (pastOrToday.length === 0) return 0;
    let cur = new Date(pastOrToday[pastOrToday.length - 1]);
    let count = 0;
    const set = new Set(dates);
    while (set.has(ymd(cur))) {
      count += 1;
      // step back one day
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
    }
    return count;
  }, [myShifts, now]);

  // Simple satisfaction placeholder (0-10). TODO: replace with real data.
  const satisfaction = 8;

  // Derive backup providers: top 2 providers who also work at the same sites this month
  const backupProviders = useMemo(() => {
    const mineSiteIds = new Set(thisMonthShifts.map(s => s.siteId));
    const others = scheduleData.providers.filter(p => p.id !== provider.id);
    const scored = others.map(p => {
      const count = scheduleData.schedules.filter(s => s.providerId === p.id && s.date.getFullYear() === now.getFullYear() && s.date.getMonth() === now.getMonth() && mineSiteIds.has(s.siteId)).length;
      return { p, count };
    }).sort((a, b) => b.count - a.count);
    return scored.slice(0, 2).map(x => x.p);
  }, [scheduleData.providers, scheduleData.schedules, provider.id, thisMonthShifts, now]);

  // Initials for avatar
  const initials = useMemo(() => {
    const parts = provider.name.split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
    return letters || 'DR';
  }, [provider.name]);

  return (
    <div className="physician-view">
      <div className="pv-tabs">
        <button className={`pv-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={`pv-tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>Calendar</button>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="pv-dashboard">
          <div className="pv-banner">
            <div className="pv-avatar">{initials}</div>
            <div className="pv-profile">
              <div className="pv-name">{provider.name}</div>
              <div className="pv-sub">{provider.specialty || 'Provider'} • Full-Time</div>
            </div>
          </div>

          <div className="pv-stats-grid">
            <div className="pv-card">
              <div className="pv-card-label">Current Streak</div>
              <div className="pv-card-value pv-blue">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</div>
            </div>
            <div className="pv-card">
              <div className="pv-card-label">Shifts</div>
              <div className="pv-card-value pv-green">{thisMonthShifts.length}/{MONTHLY_SHIFT_GOAL}</div>
            </div>
            <div className="pv-card">
              <div className="pv-card-label">Satisfaction</div>
              <div className="pv-card-value pv-purple">{satisfaction}/10</div>
            </div>
          </div>

          <div className="pv-card pv-coverage">
            <div className="pv-card-title">
              <span>Backup Coverage</span>
              <button className="pv-manage-btn" onClick={() => { /* TODO: open management UI */ }}>Manage</button>
            </div>
            <div className="pv-coverage-list">
              {backupProviders.map(bp => (
                <div key={bp.id} className="pv-coverage-item">
                  <span className="pv-check">✓</span>
                  <span className="pv-coverage-name">{bp.name}</span>
                </div>
              ))}
              {backupProviders.length === 0 && (
                <div className="pv-coverage-empty">No backup providers suggested yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="pv-calendar">
          <Calendar
            schedules={myShifts}
            providers={scheduleData.providers}
            sites={scheduleData.sites}
            selectedProvider={provider}
            selectedSite={undefined}
            onDateClick={() => {}}
          />
        </div>
      )}
    </div>
  );
};

export default PhysicianView;
