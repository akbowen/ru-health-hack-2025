import React, { useState, useEffect } from 'react';
import Calendar from './Calendar';
import PhysicianAnalytics from './PhysicianAnalytics';
import LeaveRequestForm from './LeaveRequestForm';
import LeaveRequestsList from './LeaveRequestsList';
import AvailabilityAlertForm from './AvailabilityAlertForm';
import { ScheduleData, Provider, LeaveRequest, AvailabilityAlert } from './types/schedule';
import { api } from '../utils/api';
import './PhysicianView.css';

interface PhysicianViewProps {
  provider: Provider;
  scheduleData: ScheduleData;
  username: string;
  onLogout: () => void;
}

const PhysicianView: React.FC<PhysicianViewProps> = ({ provider, scheduleData, username, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics'>('schedule');

  const myShifts = scheduleData.schedules.filter(s => s.providerId === provider.id);

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showLeaveRequests, setShowLeaveRequests] = useState(false);
  const [showAvailableShifts, setShowAvailableShifts] = useState(false);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [availableShifts, setAvailableShifts] = useState<AvailabilityAlert[]>([]);

  useEffect(() => {
    loadLeaveRequests();
    loadAvailableShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id]);

  const loadLeaveRequests = async () => {
    try {
      const requests = await api.getLeaveRequests(provider.id);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Failed to load leave requests:', error);
    }
  };

  const loadAvailableShifts = async () => {
    try {
      const alerts = await api.getAvailabilityAlerts();
      setAvailableShifts(alerts);
    } catch (error) {
      console.error('Failed to load available shifts:', error);
    }
  };

  const handleLeaveRequestSubmit = async (request: {
    date: string;
    shiftType: string;
    siteId: string;
    reason: string;
  }) => {
    try {
      const site = scheduleData.sites.find(s => s.id === request.siteId);
      await api.createLeaveRequest({
        physicianId: provider.id,
        physicianName: provider.name,
        date: request.date,
        shiftType: request.shiftType,
        siteId: request.siteId,
        siteName: site?.name || 'Unknown Site',
        reason: request.reason,
      });

      alert('Leave request submitted successfully!');
      setShowLeaveForm(false);
      loadLeaveRequests();
    } catch (error: any) {
      alert('Failed to submit leave request: ' + error.message);
    }
  };

  const handleClaimShift = async (alertId: string) => {
    try {
      await api.claimAvailableShift(alertId, provider.id, provider.name);
      alert('Shift claimed successfully!');
      setShowAvailableShifts(false);
      loadAvailableShifts();
      // Prefer a callback to refresh schedule data if available
      window.location.reload();
    } catch (error: any) {
      alert('Failed to claim shift: ' + error.message);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      await api.deleteLeaveRequest(requestId);
      alert('Leave request deleted successfully!');
      loadLeaveRequests();
    } catch (error: any) {
      alert('Failed to delete leave request: ' + error.message);
    }
  };

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;
  const openShiftsCount = availableShifts.filter(a => a.status === 'open').length;

  return (
    <div className="physician-view">
      <header>
        <h2>Welcome, Dr. {provider.name}</h2>
        <button
          className="logout-btn"
          onClick={onLogout}
          style={{ position: 'absolute', top: 20, right: 20 }}
        >
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
        <>
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

          <div className="physician-actions">
            <button className="action-btn primary" onClick={() => setShowLeaveForm(true)}>
              📝 Request Leave
            </button>
            <button className="action-btn" onClick={() => setShowLeaveRequests(true)}>
              📋 My Leave Requests {pendingCount > 0 && `(${pendingCount})`}
            </button>
            <button className="action-btn success" onClick={() => setShowAvailableShifts(true)}>
              🔔 Available Shifts {openShiftsCount > 0 && `(${openShiftsCount})`}
            </button>
          </div>
        </>
      ) : (
        <PhysicianAnalytics provider={provider} username={username} />
      )}

      {/* Modals */}
      {showLeaveForm && (
        <LeaveRequestForm
          provider={provider}
          schedules={myShifts}
          sites={scheduleData.sites}
          onSubmit={handleLeaveRequestSubmit}
          onClose={() => setShowLeaveForm(false)}
        />
      )}

      {showLeaveRequests && (
        <LeaveRequestsList
          requests={leaveRequests}
          userRole="physician"
          onDelete={handleDeleteRequest}
          onClose={() => setShowLeaveRequests(false)}
        />
      )}

      {showAvailableShifts && (
        <AvailabilityAlertForm
          alerts={availableShifts}
          userRole="physician"
          physicianId={provider.id}
          onClaim={handleClaimShift}
          onClose={() => setShowAvailableShifts(false)}
        />
      )}
    </div>
  );
};

export default PhysicianView;
