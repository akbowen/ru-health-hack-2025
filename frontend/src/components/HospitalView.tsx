import React, { useState, useEffect } from 'react';
import Calendar from './Calendar';
import StatsSummary from './StatsSummary';
import LeaveRequestsList from './LeaveRequestsList';
import { ScheduleData, Site, LeaveRequest } from './types/schedule';
import { api } from '../utils/api';
import './HospitalView.css';

interface HospitalViewProps {
  site: Site;
  scheduleData: ScheduleData;
  onLogout: () => void;
}

const HospitalView: React.FC<HospitalViewProps> = ({ site, scheduleData, onLogout }) => {
  const [showLeaveRequests, setShowLeaveRequests] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  // Filter schedules for this specific site
  const siteSchedules = scheduleData.schedules.filter(s => s.siteId === site.id);
  
  // Get providers working at this site
  const siteProviderIds = Array.from(new Set(siteSchedules.map(s => s.providerId)));
  const siteProviders = scheduleData.providers.filter(p => siteProviderIds.includes(p.id));

  useEffect(() => {
    loadLeaveRequests();
  }, [site.id]);

  const loadLeaveRequests = async () => {
    try {
      const requests = await api.getLeaveRequestsBySite(site.id);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Failed to load leave requests:', error);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await api.approveLeaveRequest(requestId, site.name);
      alert('Leave request approved! An availability alert has been created.');
      loadLeaveRequests();
      // Reload schedule data
      window.location.reload();
    } catch (error: any) {
      alert('Failed to approve request: ' + error.message);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.rejectLeaveRequest(requestId, site.name);
      alert('Leave request rejected.');
      loadLeaveRequests();
    } catch (error: any) {
      alert('Failed to reject request: ' + error.message);
    }
  };

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="hospital-view">
      <header>
        <h2>{site.name} - Hospital View</h2>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
        <p>Manage schedules and approve leave requests for your site</p>
      </header>
      
      <div className="hospital-actions">
        <button className="action-btn primary" onClick={() => setShowLeaveRequests(true)}>
          📋 Leave Requests {pendingCount > 0 && `(${pendingCount} pending)`}
        </button>
      </div>

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
            onDateClick={() => {}}
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

      {showLeaveRequests && (
        <LeaveRequestsList
          requests={leaveRequests}
          userRole="hospital"
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          onClose={() => setShowLeaveRequests(false)}
        />
      )}
    </div>
  );
};

export default HospitalView;