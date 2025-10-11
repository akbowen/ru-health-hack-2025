import React, { useState } from 'react';
import Calendar from './Calendar';
import { ScheduleData, Provider, Site, ScheduleEntry } from '../types/schedule';

interface PhysicianViewProps {
  provider: Provider;
  scheduleData: ScheduleData;
  onLogout: () => void;
}

// Each physician gets 100 credits per month
const MONTHLY_CREDITS = 100;

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PhysicianView: React.FC<PhysicianViewProps> = ({ provider, scheduleData, onLogout }) => {
  // Track credit allocation by date (YYYY-MM-DD) or by day of week
  const [creditAlloc, setCreditAlloc] = useState<{ [date: string]: number }>({});
  const [dowCredits, setDowCredits] = useState<{ [dow: string]: number }>({});

  // Filter only this provider's shifts
  const myShifts = scheduleData.schedules.filter(s => s.providerId === provider.id);

  // Calculate total credits used
  const totalCredits = Object.values(creditAlloc).reduce((a, b) => a + b, 0) +
    Object.values(dowCredits).reduce((a, b) => a + b, 0);

  // Handle credit allocation for a specific date
  const handleCreditChange = (date: string, credits: number) => {
    setCreditAlloc(prev => ({ ...prev, [date]: credits }));
  };

  // Handle credit allocation for a day of week
  const handleDowCreditChange = (dow: string, credits: number) => {
    setDowCredits(prev => ({ ...prev, [dow]: credits }));
  };

  return (
    <div className="physician-view">
      <header>
        <h2>Welcome, Dr. {provider.name}</h2>
        <button className="logout-btn" onClick={onLogout} style={{ position: 'absolute', top: 20, right: 20 }}>Logout</button>
        <p>You have <b>{MONTHLY_CREDITS - totalCredits}</b> credits remaining for this month.</p>
      </header>
      <section>
        <h3>Set Your Availability by Day of Week</h3>
        <div className="dow-credits">
          {daysOfWeek.map(dow => (
            <div key={dow} className="dow-credit-item">
              <label>{dow}:</label>
              <input
                type="number"
                min={0}
                max={MONTHLY_CREDITS - totalCredits + (dowCredits[dow] || 0)}
                value={dowCredits[dow] || ''}
                onChange={e => handleDowCreditChange(dow, Number(e.target.value))}
              />
              <span>credits</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Your Scheduled Shifts</h3>
        <Calendar
          schedules={myShifts}
          providers={scheduleData.providers}
          sites={scheduleData.sites}
          selectedProvider={provider}
          selectedSite={undefined}
          onDateClick={() => {}}
        />
      </section>
      <section>
        <h3>Indicate Preference for a Specific Date</h3>
        <div className="date-credits">
          {/* For demo: let user pick a date and assign credits */}
          <input type="date" onChange={e => handleCreditChange(e.target.value, creditAlloc[e.target.value] || 0)} />
          <input
            type="number"
            min={0}
            max={MONTHLY_CREDITS - totalCredits}
            value={creditAlloc[Object.keys(creditAlloc)[0]] || ''}
            onChange={e => handleCreditChange(Object.keys(creditAlloc)[0], Number(e.target.value))}
            disabled={!Object.keys(creditAlloc)[0]}
          />
          <span>credits</span>
        </div>
      </section>
    </div>
  );
};

export default PhysicianView;
