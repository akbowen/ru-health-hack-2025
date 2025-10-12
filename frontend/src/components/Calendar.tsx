import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getDay } from 'date-fns';
import { ScheduleEntry, Provider, Site } from './types/schedule';
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
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  // PDF Export function
  const exportToPDF = async () => {
    if (!calendarRef.current) return;
    
    setIsExporting(true);
    setShowExportMenu(false);
    
    try {
      // Dynamically import libraries
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Capture the calendar as canvas
      const canvas = await html2canvas(calendarRef.current, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Generate filename
      const filename = `schedule-${format(currentDate, 'yyyy-MM')}.pdf`;
      pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Google Calendar Export function (only for physicians)
  const exportToGoogleCalendar = () => {
    setShowExportMenu(false);
    
    // Get all schedules for the current month
    const monthSchedules = filteredSchedules.filter(schedule => {
      const scheduleMonth = schedule.date.getMonth();
      const scheduleYear = schedule.date.getFullYear();
      return scheduleMonth === currentDate.getMonth() && scheduleYear === currentDate.getFullYear();
    });

    if (monthSchedules.length === 0) {
      alert('No schedules found for this month.');
      return;
    }

    // Create ICS file content
    const icsContent = generateICSFile(monthSchedules);
    
    // Download ICS file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `schedule-${format(currentDate, 'yyyy-MM')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    alert('Calendar file downloaded! Import it to Google Calendar:\n1. Open Google Calendar\n2. Click Settings (gear icon) → Settings\n3. Click "Import & Export" on the left\n4. Click "Select file from your computer"\n5. Choose the downloaded .ics file');
  };

  // Generate ICS file format
  const generateICSFile = (schedules: ScheduleEntry[]) => {
    const formatICSDate = (date: Date, time?: string) => {
      // Default times for different shift types
      const shiftTimes: { [key: string]: { start: string, end: string } } = {
        'MD1': { start: '08:00', end: '12:00' },
        'MD2': { start: '13:00', end: '17:00' },
        'PM': { start: '09:00', end: '17:00' }
      };
      
      const [hours, minutes] = (time && shiftTimes[time]?.start || '08:00').split(':');
      const startDate = new Date(date);
      startDate.setHours(parseInt(hours), parseInt(minutes), 0);
      
      return startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const formatICSEndDate = (date: Date, time?: string) => {
      const shiftTimes: { [key: string]: { start: string, end: string } } = {
        'MD1': { start: '08:00', end: '12:00' },
        'MD2': { start: '13:00', end: '17:00' },
        'PM': { start: '09:00', end: '17:00' }
      };
      
      const [hours, minutes] = (time && shiftTimes[time]?.end || '17:00').split(':');
      const endDate = new Date(date);
      endDate.setHours(parseInt(hours), parseInt(minutes), 0);
      
      return endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Schedule Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    schedules.forEach(schedule => {
      const providerName = getProviderName(schedule.providerId);
      const siteName = getSiteName(schedule.siteId);
      const uid = `${schedule.id}@schedulecalendar.com`;
      
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(schedule.date, schedule.startTime)}`,
        `DTEND:${formatICSEndDate(schedule.date, schedule.startTime)}`,
        `SUMMARY:${schedule.startTime} - ${providerName} at ${siteName}`,
        `DESCRIPTION:Provider: ${providerName}\\nSite: ${siteName}\\nShift: ${schedule.startTime}\\nStatus: ${schedule.status}`,
        `LOCATION:${siteName}`,
        `STATUS:${schedule.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');
    
    return icsContent.join('\r\n');
  };

  // Extract complete schedule data for AI/Chatbot
  const exportCompleteScheduleData = () => {
    setShowExportMenu(false);
    
    // Get all schedules for the current month
    const monthSchedules = filteredSchedules.filter(schedule => {
      const scheduleMonth = schedule.date.getMonth();
      const scheduleYear = schedule.date.getFullYear();
      return scheduleMonth === currentDate.getMonth() && scheduleYear === currentDate.getFullYear();
    });

    if (monthSchedules.length === 0) {
      alert('No schedules found for this month.');
      return;
    }

    // Group schedules by date
    const schedulesByDate = new Map<string, ScheduleEntry[]>();
    
    monthSchedules.forEach(schedule => {
      const dateKey = format(schedule.date, 'yyyy-MM-dd');
      if (!schedulesByDate.has(dateKey)) {
        schedulesByDate.set(dateKey, []);
      }
      schedulesByDate.get(dateKey)!.push(schedule);
    });

    // Generate comprehensive text document
    let documentContent = `COMPLETE SCHEDULE DATA - ${format(currentDate, 'MMMM yyyy')}\n`;
    documentContent += `Generated on: ${format(new Date(), 'PPpp')}\n`;
    documentContent += `Total Schedules: ${monthSchedules.length}\n`;
    documentContent += `\n${'='.repeat(80)}\n\n`;

    // Sort dates
    const sortedDates = Array.from(schedulesByDate.keys()).sort();

    sortedDates.forEach(dateKey => {
      const date = new Date(dateKey);
      const daySchedules = schedulesByDate.get(dateKey)!;
      
      documentContent += `DATE: ${format(date, 'EEEE, MMMM d, yyyy')}\n`;
      documentContent += `${'-'.repeat(80)}\n`;
      documentContent += `Total Entries: ${daySchedules.length}\n\n`;

      // Sort schedules for this date
      const sortedSchedules = daySchedules.sort((a, b) => {
        const shiftOrder: { [key: string]: number } = { 'MD1': 1, 'MD2': 2, 'PM': 3 };
        const orderA = shiftOrder[a.startTime] || 999;
        const orderB = shiftOrder[b.startTime] || 999;
        
        if (orderA !== orderB) return orderA - orderB;
        
        const providerA = getProviderName(a.providerId);
        const providerB = getProviderName(b.providerId);
        return providerA.localeCompare(providerB);
      });

      sortedSchedules.forEach((schedule, index) => {
        documentContent += `  Entry ${index + 1}:\n`;
        documentContent += `    Shift Type: ${schedule.startTime}\n`;
        documentContent += `    Provider: ${getProviderName(schedule.providerId)}\n`;
        documentContent += `    Site: ${getSiteName(schedule.siteId)}\n`;
        documentContent += `    Status: ${schedule.status}\n`;
        documentContent += `    Start Time: ${schedule.startTime}\n`;
        documentContent += `    End Time: ${schedule.endTime || 'Not specified'}\n`;
        documentContent += `    Schedule ID: ${schedule.id}\n`;
        documentContent += `\n`;
      });

      documentContent += `\n`;
    });

    // Add summary statistics
    documentContent += `${'='.repeat(80)}\n`;
    documentContent += `SUMMARY STATISTICS\n`;
    documentContent += `${'='.repeat(80)}\n\n`;

    // Count by shift type
    const shiftCounts = new Map<string, number>();
    monthSchedules.forEach(schedule => {
      const count = shiftCounts.get(schedule.startTime) || 0;
      shiftCounts.set(schedule.startTime, count + 1);
    });

    documentContent += `Schedules by Shift Type:\n`;
    shiftCounts.forEach((count, shift) => {
      documentContent += `  ${shift}: ${count} shifts\n`;
    });
    documentContent += `\n`;

    // Count by provider
    const providerCounts = new Map<string, number>();
    monthSchedules.forEach(schedule => {
      const providerName = getProviderName(schedule.providerId);
      const count = providerCounts.get(providerName) || 0;
      providerCounts.set(providerName, count + 1);
    });

    documentContent += `Schedules by Provider:\n`;
    Array.from(providerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([provider, count]) => {
        documentContent += `  ${provider}: ${count} shifts\n`;
      });
    documentContent += `\n`;

    // Count by site
    const siteCounts = new Map<string, number>();
    monthSchedules.forEach(schedule => {
      const siteName = getSiteName(schedule.siteId);
      const count = siteCounts.get(siteName) || 0;
      siteCounts.set(siteName, count + 1);
    });

    documentContent += `Schedules by Site:\n`;
    Array.from(siteCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([site, count]) => {
        documentContent += `  ${site}: ${count} shifts\n`;
      });

    // Download as text file
    const blob = new Blob([documentContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `complete-schedule-data-${format(currentDate, 'yyyy-MM')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    alert('Complete schedule data downloaded! This file contains all schedule details and can be used with your Gemini API chatbot.');
  };

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
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanksCount = getDay(monthStart);
  const leadingBlanks = Array.from({ length: leadingBlanksCount }, () => null as Date | null);
  const totalCells = leadingBlanksCount + monthDays.length;
  const trailingBlanksCount = (7 - (totalCells % 7)) % 7;
  const trailingBlanks = Array.from({ length: trailingBlanksCount }, () => null as Date | null);
  const calendarCells: Array<Date | null> = [...leadingBlanks, ...monthDays, ...trailingBlanks];

  const getSchedulesForDate = (date: Date) => {
    const daySchedules = filteredSchedules.filter(schedule => isSameDay(schedule.date, date));
    
    if (selectedSite) {
      const shiftOrder: { [key: string]: number } = {
        'MD1': 1,
        'MD2': 2,
        'PM': 3
      };
      
      return daySchedules.sort((a, b) => {
        const orderA = shiftOrder[a.startTime] || 999;
        const orderB = shiftOrder[b.startTime] || 999;
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        const providerA = getProviderName(a.providerId);
        const providerB = getProviderName(b.providerId);
        return providerA.localeCompare(providerB);
      });
    }
    
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
    
    const combinedSchedules = Array.from(groupedSchedules.values()).map(group => ({
      id: group.scheduleIds.join('-'),
      providerId: group.providerId,
      siteId: 'combined',
      date: date,
      startTime: group.startTime,
      endTime: '',
      status: group.status,
      sites: group.sites
    }));
    
    const shiftOrder: { [key: string]: number } = {
      'MD1': 1,
      'MD2': 2,
      'PM': 3
    };
    
    return combinedSchedules.sort((a, b) => {
      const orderA = shiftOrder[a.startTime] || 999;
      const orderB = shiftOrder[b.startTime] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
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
    <div className="calendar" ref={calendarRef}>
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
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)} 
            className="today-button"
            disabled={isExporting}
          >
            {isExporting ? 'Generating PDF...' : 'Export ▼'}
          </button>
          {showExportMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '8px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '200px',
              overflow: 'hidden'
            }}>
              <button
                onClick={exportToPDF}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                📄 Download as PDF
              </button>
              <button
                onClick={exportToGoogleCalendar}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background 0.2s',
                  borderTop: '1px solid #eee'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                📅 Export to Google Calendar
              </button>
              <button
                onClick={exportCompleteScheduleData}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background 0.2s',
                  borderTop: '1px solid #eee'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                🤖 Export Complete Data (for AI)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`blank-${idx}`} className="calendar-day blank-day" />;
          }
          const day = cell;
          const daySchedules = getSchedulesForDate(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`calendar-day ${isCurrentDay ? 'today' : ''} ${daySchedules.length > 0 ? 'has-schedule' : ''}`}
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
                      {!selectedSite && schedule.siteId === 'combined' && (schedule as any).sites && (
                        <div className="combined-sites">
                          {(schedule as any).sites.slice(0, 3).join(', ')}
                          {(schedule as any).sites.length > 3 && ` +${(schedule as any).sites.length - 3} more`}
                        </div>
                      )}
                      {!selectedSite && schedule.siteId !== 'combined' && (
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