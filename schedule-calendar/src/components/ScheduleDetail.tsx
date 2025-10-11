import React from 'react';
import { format } from 'date-fns';
import { ScheduleEntry, Provider, Site } from '../types/schedule';
import './ScheduleDetail.css';

interface ScheduleDetailProps {
  selectedDate?: Date;
  schedules: ScheduleEntry[];
  providers: Provider[];
  sites: Site[];
  onClose: () => void;
}

const ScheduleDetail: React.FC<ScheduleDetailProps> = ({
  selectedDate,
  schedules,
  providers,
  sites,
  onClose
}) => {
  if (!selectedDate) return null;

  const daySchedules = schedules.filter(schedule => 
    format(schedule.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  );

  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.name || 'Unknown Provider';
  };

  const getSiteName = (siteId: string) => {
    return sites.find(s => s.id === siteId)?.name || 'Unknown Site';
  };

  const getProviderSpecialty = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.specialty || '';
  };

  const getSiteType = (siteId: string) => {
    return sites.find(s => s.id === siteId)?.type || '';
  };

  return (
    <div className="schedule-detail-overlay">
      <div className="schedule-detail-modal">
        <div className="schedule-detail-header">
          <h2>Schedule for {format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <div className="schedule-detail-content">
          {daySchedules.length === 0 ? (
            <div className="no-schedules">
              <p>No schedules for this date.</p>
            </div>
          ) : (
            <div className="schedules-list">
              {daySchedules
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(schedule => (
                <div key={schedule.id} className={`schedule-card ${schedule.status}`}>
                  <div className="schedule-header">
                    <div className="time-range">
                      {schedule.startTime} - {schedule.endTime}
                    </div>
                    <div className={`status-badge ${schedule.status}`}>
                      {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                    </div>
                  </div>
                  
                  <div className="schedule-info">
                    <div className="provider-info">
                      <h4>{getProviderName(schedule.providerId)}</h4>
                      {getProviderSpecialty(schedule.providerId) && (
                        <span className="specialty">{getProviderSpecialty(schedule.providerId)}</span>
                      )}
                    </div>
                    
                    <div className="site-info">
                      <h5>{getSiteName(schedule.siteId)}</h5>
                      {getSiteType(schedule.siteId) && (
                        <span className="site-type">{getSiteType(schedule.siteId)}</span>
                      )}
                    </div>
                  </div>
                  
                  {schedule.notes && (
                    <div className="schedule-notes">
                      <strong>Notes:</strong> {schedule.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetail;