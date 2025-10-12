import React from 'react';
import { format } from 'date-fns';
import { ScheduleEntry, Provider, Site } from './types/schedule';
import './ScheduleDetail.css';

interface ScheduleDetailProps {
  selectedDate?: Date;
  schedules: ScheduleEntry[];
  providers: Provider[];
  sites: Site[];
  selectedProvider?: Provider;
  selectedSite?: Site;
  onClose: () => void;
}

const ScheduleDetail: React.FC<ScheduleDetailProps> = ({
  selectedDate,
  schedules,
  providers,
  sites,
  selectedProvider,
  selectedSite,
  onClose
}) => {
  if (!selectedDate) return null;

  // Apply provider and site filtering
  const filteredSchedules = schedules.filter(schedule => {
    if (selectedProvider && schedule.providerId !== selectedProvider.id) {
      return false;
    }
    if (selectedSite && schedule.siteId !== selectedSite.id) {
      return false;
    }
    return true;
  });

  const daySchedules = filteredSchedules.filter(schedule => 
    format(schedule.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  );

  // Apply the same grouping logic as Calendar when no specific site is selected
  const getProcessedSchedules = () => {
    if (selectedSite) {
      // Show individual entries when a specific site is selected
      return daySchedules.sort((a, b) => {
        const shiftOrder: { [key: string]: number } = {
          'MD1': 1, 'MD2': 2, 'PM': 3
        };
        const orderA = shiftOrder[a.startTime] || 999;
        const orderB = shiftOrder[b.startTime] || 999;
        if (orderA !== orderB) return orderA - orderB;
        
        const providerA = getProviderName(a.providerId);
        const providerB = getProviderName(b.providerId);
        return providerA.localeCompare(providerB);
      });
    }

    // Group by provider and shift when "All Sites" is selected
    const groupedSchedules = new Map<string, {
      providerId: string;
      startTime: string;
      sites: string[];
      scheduleIds: string[];
      status: string;
    }>();
    
    daySchedules.forEach(schedule => {
      const key = `${schedule.providerId}-${schedule.startTime}`;
      const siteName = getSiteName(schedule.siteId);
      
      if (groupedSchedules.has(key)) {
        const group = groupedSchedules.get(key)!;
        if (!group.sites.includes(siteName)) {
          group.sites.push(siteName);
          group.scheduleIds.push(schedule.id);
        }
      } else {
        groupedSchedules.set(key, {
          providerId: schedule.providerId,
          startTime: schedule.startTime,
          sites: [siteName],
          scheduleIds: [schedule.id],
          status: schedule.status
        });
      }
    });
    
    return Array.from(groupedSchedules.values()).map(group => ({
      id: group.scheduleIds.join('-'),
      providerId: group.providerId,
      siteId: 'combined',
      date: selectedDate,
      startTime: group.startTime,
      endTime: '',
      status: group.status,
      sites: group.sites
    })).sort((a, b) => {
      const shiftOrder: { [key: string]: number } = {
        'MD1': 1, 'MD2': 2, 'PM': 3
      };
      const orderA = shiftOrder[a.startTime] || 999;
      const orderB = shiftOrder[b.startTime] || 999;
      if (orderA !== orderB) return orderA - orderB;
      
      const providerA = getProviderName(a.providerId);
      const providerB = getProviderName(b.providerId);
      return providerA.localeCompare(providerB);
    });
  };

  // Helper functions need to be defined before being used
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

  const processedSchedules = getProcessedSchedules();

  return (
    <div className="schedule-detail-overlay">
      <div className="schedule-detail-modal">
        <div className="schedule-detail-header">
          <h2>Schedule for {format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <div className="schedule-detail-content">
          {processedSchedules.length === 0 ? (
            <div className="no-schedules">
              <p>No schedules for this date.</p>
            </div>
          ) : (
            <div className="schedules-list">
              {processedSchedules
                .map(schedule => (
                <div key={schedule.id} className={`schedule-card ${schedule.status}`}>
                  <div className="schedule-header">
                    <div className="time-range">
                      {schedule.startTime}
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
                      {schedule.siteId === 'combined' && (schedule as any).sites ? (
                        <div className="combined-sites-detail">
                          <strong>Sites:</strong>
                          <ul>
                            {(schedule as any).sites.map((siteName: string, index: number) => (
                              <li key={index}>
                                {siteName}
                                {sites.find(s => s.name === siteName)?.type && (
                                  <span className="site-type"> - {sites.find(s => s.name === siteName)?.type}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="single-site-detail">
                          <h5>{getSiteName(schedule.siteId)}</h5>
                          {getSiteType(schedule.siteId) && (
                            <span className="site-type">{getSiteType(schedule.siteId)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {(schedule as any).notes && (
                    <div className="schedule-notes">
                      <strong>Notes:</strong> {(schedule as any).notes}
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