import React from 'react';
import Calendar from './Calendar';
import StatsSummary from './StatsSummary';
import { ScheduleData, Site } from '../types/schedule';

interface HospitalViewProps {
  site: Site;
  scheduleData: ScheduleData;
  onLogout: () => void;
}

const HospitalView: React.FC<HospitalViewProps> = ({ site, scheduleData, onLogout }) => {
  // Filter schedules for this specific site
  const siteSchedules = scheduleData.schedules.filter(s => s.siteId === site.id);
  
  // Get providers working at this site
  const siteProviderIds = Array.from(new Set(siteSchedules.map(s => s.providerId)));
  const siteProviders = scheduleData.providers.filter(p => siteProviderIds.includes(p.id));

  return (
    <div className="hospital-view">
      <header>
        <h2>{site.name} - Hospital View</h2>
        <button className="logout-btn" onClick={onLogout} style={{ position: 'absolute', top: 20, right: 20 }}>
          Logout
        </button>
        <p>View schedules and provider assignments for your site</p>
      </header>
      
      <main>
        <StatsSummary
          scheduleData={{
            providers: siteProviders,
            sites: [site],
            schedules: siteSchedules
          }}
          selectedProvider={undefined}
          selectedSite={site}
        />
        
        <section>
          <h3>Site Schedule</h3>
          <Calendar
            schedules={siteSchedules}
            providers={scheduleData.providers}
            sites={[site]}
            selectedProvider={undefined}
            selectedSite={site}
            onDateClick={() => {}} // Hospital view doesn't need date selection
          />
        </section>
        
        <section>
          <h3>Provider Overview</h3>
          <div className="provider-list">
            {siteProviders.length === 0 ? (
              <p>No providers currently assigned to this site.</p>
            ) : (
              <div className="provider-grid">
                {siteProviders.map(provider => {
                  const providerShifts = siteSchedules.filter(s => s.providerId === provider.id);
                  return (
                    <div key={provider.id} className="provider-card">
                      <h4>{provider.name}</h4>
                      <p>Specialty: {provider.specialty || 'General Practice'}</p>
                      <p>Shifts this month: {providerShifts.length}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default HospitalView;