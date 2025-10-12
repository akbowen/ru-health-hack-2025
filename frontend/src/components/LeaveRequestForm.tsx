import React, { useState } from 'react';
import { Provider, Site, ScheduleEntry } from './types/schedule';
import './LeaveRequestForm.css';

interface LeaveRequestFormProps {
  provider: Provider;
  schedules: ScheduleEntry[];
  sites: Site[];
  onSubmit: (request: {
    date: string;
    shiftType: string;
    siteId: string;
    reason: string;
  }) => void;
  onClose: () => void;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({
  provider,
  schedules,
  sites,
  onSubmit,
  onClose
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [reason, setReason] = useState('');

  // Get shifts for selected date
  const shiftsForDate = selectedDate
    ? schedules.filter(s => {
        const scheduleDate = s.date.toISOString().split('T')[0];
        return scheduleDate === selectedDate;
      })
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedShift || !selectedSite || !reason.trim()) {
      alert('Please fill in all fields');
      return;
    }
    onSubmit({
      date: selectedDate,
      shiftType: selectedShift,
      siteId: selectedSite,
      reason: reason.trim()
    });
  };

  return (
    <div className="leave-request-overlay">
      <div className="leave-request-modal">
        <div className="leave-request-header">
          <h2>Request Leave</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="leave-request-form">
          <div className="form-group">
            <label htmlFor="date">Select Date:</label>
            <select
              id="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedShift('');
                setSelectedSite('');
              }}
              required
            >
              <option value="">-- Choose Date --</option>
              {Array.from(new Set(schedules.map(s => s.date.toISOString().split('T')[0])))
                .sort()
                .map(date => (
                  <option key={date} value={date}>
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </option>
                ))}
            </select>
          </div>

          {selectedDate && (
            <div className="form-group">
              <label htmlFor="shift">Select Shift:</label>
              <select
                id="shift"
                value={selectedShift}
                onChange={(e) => {
                  setSelectedShift(e.target.value);
                  const shift = shiftsForDate.find(s => s.startTime === e.target.value);
                  if (shift) setSelectedSite(shift.siteId);
                }}
                required
              >
                <option value="">-- Choose Shift --</option>
                {shiftsForDate.map(shift => (
                  <option key={`${shift.id}-${shift.startTime}`} value={shift.startTime}>
                    {shift.startTime} - {sites.find(s => s.id === shift.siteId)?.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="reason">Reason for Leave:</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for your leave request..."
              rows={4}
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveRequestForm;