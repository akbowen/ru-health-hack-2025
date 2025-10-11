import React, { useState } from 'react';
import Calendar from './components/Calendar';
import FilterPanel from './components/FilterPanel';
import ScheduleDetail from './components/ScheduleDetail';
import StatsSummary from './components/StatsSummary';
import { ScheduleData, Provider, Site } from './types/schedule';
import { parseScheduleExcel, getSampleScheduleData } from './utils/scheduleParser';
import './App.css';

function App() {
  const [scheduleData, setScheduleData] = useState<ScheduleData>(() => getSampleScheduleData());
  const [selectedProvider, setSelectedProvider] = useState<Provider | undefined>();
  const [selectedSite, setSelectedSite] = useState<Site | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(undefined);
    setSuccessMessage(undefined);
    
    try {
      const data = await parseScheduleExcel(file);
      setScheduleData(data);
      // Reset filters when new data is loaded
      setSelectedProvider(undefined);
      setSelectedSite(undefined);
      setSuccessMessage(`Successfully loaded ${data.providers.length} providers and ${data.sites.length} sites with ${data.schedules.length} schedule entries!`);
    } catch (err) {
      setError('Failed to parse Excel file. Please check the file format and ensure it matches the expected structure.');
      console.error('Error parsing file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCloseDetail = () => {
    setSelectedDate(undefined);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Provider Schedule Calendar</h1>
        <p>View and manage provider schedules across different sites</p>
      </header>
      
      <main className="App-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
        
        {isLoading && (
          <div className="loading-message">
            Loading schedule data...
          </div>
        )}
        
        <FilterPanel
          providers={scheduleData.providers}
          sites={scheduleData.sites}
          selectedProvider={selectedProvider}
          selectedSite={selectedSite}
          onProviderChange={setSelectedProvider}
          onSiteChange={setSelectedSite}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
        />
        
        <StatsSummary
          scheduleData={scheduleData}
          selectedProvider={selectedProvider}
          selectedSite={selectedSite}
        />
        
        <Calendar
          schedules={scheduleData.schedules}
          providers={scheduleData.providers}
          sites={scheduleData.sites}
          selectedProvider={selectedProvider}
          selectedSite={selectedSite}
          onDateClick={handleDateClick}
        />
        
        <ScheduleDetail
          selectedDate={selectedDate}
          schedules={scheduleData.schedules}
          providers={scheduleData.providers}
          sites={scheduleData.sites}
          onClose={handleCloseDetail}
        />
      </main>
    </div>
  );
}

export default App;
