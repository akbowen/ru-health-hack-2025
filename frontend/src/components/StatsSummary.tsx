import React from 'react';
import { ScheduleData } from './types/schedule';
import './StatsSummary.css';

interface StatsSummaryProps {
  scheduleData: ScheduleData;
  selectedProvider?: any;
  selectedSite?: any;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({
  scheduleData,
  selectedProvider,
  selectedSite
}) => {
  const { schedules } = scheduleData;
  
  // Filter schedules based on current filters
  const filteredSchedules = schedules.filter(schedule => {
    if (selectedProvider && schedule.providerId !== selectedProvider.id) {
      return false;
    }
    if (selectedSite && schedule.siteId !== selectedSite.id) {
      return false;
    }
    return true;
  });
  
  // Calculate stats based on filtered schedules only
  const totalSchedules = filteredSchedules.length;
  const uniqueProviderIds = new Set(filteredSchedules.map(s => s.providerId));
  const uniqueSiteIds = new Set(filteredSchedules.map(s => s.siteId));
  const totalProviders = uniqueProviderIds.size;
  const totalSites = uniqueSiteIds.size;
  
  // Get date range
  const dates = filteredSchedules.map(s => s.date.getTime());
  const startDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const endDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;
  
  return (
    <div className="stats-summary">
      <h3>Schedule Overview</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-number">{totalProviders}</div>
          <div className="stat-label">Providers</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{totalSites}</div>
          <div className="stat-label">Sites</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{totalSchedules}</div>
          <div className="stat-label">Total Assignments</div>
        </div>
      </div>
      
      {startDate && endDate && (
        <div className="date-range">
          <strong>Schedule Period:</strong>{' '}
          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
        </div>
      )}
      
      {(selectedProvider || selectedSite) && (
        <div className="filter-info">
          {selectedProvider && (
            <div>Viewing: <strong>{selectedProvider.name}</strong></div>
          )}
          {selectedSite && (
            <div>Location: <strong>{selectedSite.name}</strong></div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatsSummary;