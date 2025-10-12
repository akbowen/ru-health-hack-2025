import React, { useState } from 'react';
import Calendar from './Calendar';
import PhysicianAnalytics from './PhysicianAnalytics';
import ScheduleChatbot from './ScheduleChatbot';
import { ScheduleData, Provider } from '../types/schedule';

interface PhysicianViewProps {
  provider: Provider;
  scheduleData: ScheduleData;
  username: string;
  onLogout: () => void;
}

const PhysicianView: React.FC<PhysicianViewProps> = ({ provider, scheduleData, username, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics'>('schedule');

  const myShifts = scheduleData.schedules.filter(s => s.providerId === provider.id);

  return (
    <div className="physician-view">
      <header>
        <h2>Welcome, Dr. {provider.name}</h2>
        <button className="logout-btn" onClick={onLogout} style={{ position: 'absolute', top: 20, right: 20 }}>
          Logout
        </button>
      </header>

      <nav className="physician-tabs" style={{ marginTop: 20, marginBottom: 30 }}>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`physician-tab ${activeTab === 'schedule' ? 'physician-tab--active' : ''}`}
          style={{ marginRight: 10 }}
        >
          My Schedule
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`physician-tab ${activeTab === 'analytics' ? 'physician-tab--active' : ''}`}
        >
          Analytics
        </button>
      </nav>

      {activeTab === 'schedule' ? (
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
      ) : (
        <PhysicianAnalytics provider={provider} username={username} />
      )}

      {/* Add Chatbot */}
      <ScheduleChatbot username={username} />
    </div>
  );
};

export default PhysicianView;