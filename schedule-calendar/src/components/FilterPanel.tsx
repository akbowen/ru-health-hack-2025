import React from 'react';
import { Provider, Site } from '../types/schedule';
import './FilterPanel.css';

interface FilterPanelProps {
  providers: Provider[];
  sites: Site[];
  selectedProvider?: Provider;
  selectedSite?: Site;
  onProviderChange: (provider?: Provider) => void;
  onSiteChange: (site?: Site) => void;
  onFileUpload?: (file: File) => void;
  isLoading?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  providers,
  sites,
  selectedProvider,
  selectedSite,
  onProviderChange,
  onSiteChange,
  onFileUpload,
  isLoading = false
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div className="filter-panel">
      <div className="filter-section">
        <h3>Upload Schedule</h3>
        <div className="file-upload">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            id="schedule-file"
            className="file-input"
          />
          <label htmlFor="schedule-file" className={`file-label ${isLoading ? 'loading' : ''}`}>
            {isLoading ? 'Processing...' : 'Choose Excel File'}
          </label>
          <div className="file-help">
            <p>Upload your provider schedule Excel file from sample-data/Sample Schedule.xlsx format</p>
          </div>
        </div>
      </div>

      <div className="filter-section">
        <h3>Filter by Provider</h3>
        <select
          value={selectedProvider?.id || ''}
          onChange={(e) => {
            const provider = providers.find(p => p.id === e.target.value);
            onProviderChange(provider);
          }}
          className="filter-select"
        >
          <option value="">All Providers</option>
          {providers.map(provider => (
            <option key={provider.id} value={provider.id}>
              {provider.name} {provider.specialty && `(${provider.specialty})`}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-section">
        <h3>Filter by Site</h3>
        <select
          value={selectedSite?.id || ''}
          onChange={(e) => {
            const site = sites.find(s => s.id === e.target.value);
            onSiteChange(site);
          }}
          className="filter-select"
        >
          <option value="">All Sites</option>
          {sites.map(site => (
            <option key={site.id} value={site.id}>
              {site.name} {site.type && `(${site.type})`}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-section">
        <h3>Current View</h3>
        <div className="current-filters">
          {selectedProvider && (
            <div className="filter-tag">
              Provider: {selectedProvider.name}
              <button 
                onClick={() => onProviderChange(undefined)}
                className="remove-filter"
              >
                ×
              </button>
            </div>
          )}
          {selectedSite && (
            <div className="filter-tag">
              Site: {selectedSite.name}
              <button 
                onClick={() => onSiteChange(undefined)}
                className="remove-filter"
              >
                ×
              </button>
            </div>
          )}
          {!selectedProvider && !selectedSite && (
            <div className="no-filters">Showing all schedules</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;