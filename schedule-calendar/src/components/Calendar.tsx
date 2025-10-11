import React, { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ScheduleEntry, Provider, Site } from '../types/schedule';
import './Calendar.css';

interface CalendarProps {
  schedules: ScheduleEntry[];
  providers: Provider[];
  sites: Site[];
  selectedProvider?: Provider;
  selectedSite?: Site;
  onDateClick?: (date: Date) => void;
}

const Calendar: React.FC<CalendarProps> = ({
  schedules,
  providers,
  sites,
  selectedProvider,
  selectedSite,
  onDateClick
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return; // Don't interfere with form inputs
      }
      
      const newDate = new Date(currentDate);
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          newDate.setMonth(newDate.getMonth() - 1);
          setCurrentDate(newDate);
          break;
        case 'ArrowRight':
          event.preventDefault();
          newDate.setMonth(newDate.getMonth() + 1);
          setCurrentDate(newDate);
          break;
        case 'Home':
          event.preventDefault();
          setCurrentDate(new Date());
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      if (selectedProvider && schedule.providerId !== selectedProvider.id) {
        return false;
      }
      if (selectedSite && schedule.siteId !== selectedSite.id) {
        return false;
      }
      return true;
    });
  }, [schedules, selectedProvider, selectedSite]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSchedulesForDate = (date: Date) => {
    const daySchedules = filteredSchedules.filter(schedule => isSameDay(schedule.date, date));
    
    // Sort schedules by shift type in chronological order: MD1 → MD2 → PM
    const shiftOrder: { [key: string]: number } = {
      'MD1': 1,   // First shift
      'MD2': 2,   // Second shift  
      'PM': 3     // Practice Management (last)
    };
    
    return daySchedules.sort((a, b) => {
      const orderA = shiftOrder[a.startTime] || 999;
      const orderB = shiftOrder[b.startTime] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same shift type, sort by provider name
      const providerA = getProviderName(a.providerId);
      const providerB = getProviderName(b.providerId);
      return providerA.localeCompare(providerB);
    });
  };

  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.name || 'Unknown Provider';
  };

  const getSiteName = (siteId: string) => {
    return sites.find(s => s.id === siteId)?.name || 'Unknown Site';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button onClick={() => navigateMonth('prev')} className="nav-button">
          ← Previous
        </button>
        <h2 className="month-title">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <button onClick={() => navigateMonth('next')} className="nav-button">
          Next →
        </button>
        <button onClick={goToToday} className="today-button">
          Today
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map(day => {
          const daySchedules = getSchedulesForDate(day);
          const isCurrentDay = isToday(day);
          const isInCurrentMonth = isCurrentMonth(day);

          return (
            <div
              key={day.toISOString()}
              className={`calendar-day ${isCurrentDay ? 'today' : ''} ${daySchedules.length > 0 ? 'has-schedule' : ''} ${!isInCurrentMonth ? 'other-month' : ''}`}
              onClick={() => onDateClick?.(day)}
            >
              <div className="day-number">
                {format(day, 'd')}
              </div>
              <div className="day-schedules">
                {daySchedules.slice(0, 3).map(schedule => (
                  <div key={schedule.id} className={`schedule-item ${schedule.status}`}>
                    <div className="schedule-time">
                      {schedule.startTime}
                    </div>
                    <div className="schedule-info">
                      {!selectedProvider && (
                        <div className="provider-name">
                          {getProviderName(schedule.providerId)}
                        </div>
                      )}
                      {!selectedSite && (
                        <div className="site-name">
                          {getSiteName(schedule.siteId)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {daySchedules.length > 3 && (
                  <div className="more-schedules">
                    +{daySchedules.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="calendar-help">
        <p>Use ← → arrow keys to navigate months, Home key to go to today</p>
      </div>
    </div>
  );
};

export default Calendar;