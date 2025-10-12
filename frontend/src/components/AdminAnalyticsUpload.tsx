import React, { useState } from 'react';
import { api } from '../utils/api';
import './AdminAnalyticsUpload.css';

const AdminAnalyticsUpload: React.FC = () => {
  const [files, setFiles] = useState<{
    scheduleFile?: File;
    volumeFile?: File;
    contractFile?: File;
    credentialingFile?: File;
  }>({});
  
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (fieldName: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [fieldName]: file }));
    } else {
      setFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[fieldName as keyof typeof files];
        return newFiles;
      });
    }
  };

  const handleUpload = async () => {
    if (Object.keys(files).length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one file to upload' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const result = await api.uploadAnalysisFiles(files);
      setMessage({ type: 'success', text: result.message });
      setFiles({});
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const fileInputs = [
    {
      name: 'scheduleFile',
      label: 'Schedule File',
      description: 'Final_Schedule-2.xlsx - Contains shift assignments by day',
      required: true
    },
    {
      name: 'volumeFile',
      label: 'Facility Volume File',
      description: 'Facility volume.xlsx - Contains volume data for each facility',
      required: true
    },
    {
      name: 'contractFile',
      label: 'Contract File',
      description: 'Provider contract.xlsx - Contains contract limits and preferences',
      required: true
    },
    {
      name: 'credentialingFile',
      label: 'Credentialing File',
      description: 'Provider Credentialing.xlsx - Contains facility credentialing info',
      required: true
    }
  ];

  return (
    <div className="admin-analytics-upload">
      <div className="upload-header">
        <h2>Upload Analytics Files</h2>
        <p>Upload the required Excel files to enable physician analytics</p>
      </div>

      {message && (
        <div className={`upload-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="upload-grid">
        {fileInputs.map(input => (
          <div key={input.name} className="upload-item">
            <div className="upload-item-header">
              <label className="upload-label">
                {input.label}
                {input.required && <span className="required">*</span>}
              </label>
              <p className="upload-description">{input.description}</p>
            </div>

            <div className="file-input-wrapper">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileChange(input.name, e.target.files?.[0] || null)}
                className="file-input"
                id={input.name}
              />
              <label htmlFor={input.name} className="file-input-label">
                <span className="file-icon">📁</span>
                {files[input.name as keyof typeof files] ? (
                  <span className="file-name">{files[input.name as keyof typeof files]!.name}</span>
                ) : (
                  <span className="file-placeholder">Choose file...</span>
                )}
              </label>
              
              {files[input.name as keyof typeof files] && (
                <button
                  type="button"
                  onClick={() => handleFileChange(input.name, null)}
                  className="clear-btn"
                  title="Remove file"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="upload-actions">
        <button
          onClick={handleUpload}
          disabled={uploading || Object.keys(files).length === 0}
          className="upload-btn"
        >
          {uploading ? 'Uploading...' : 'Upload Files'}
        </button>
        
        {Object.keys(files).length > 0 && (
          <button
            onClick={() => setFiles({})}
            disabled={uploading}
            className="clear-all-btn"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="upload-info">
        <h3>📋 File Requirements</h3>
        <ul>
          <li>All files must be in Excel format (.xlsx or .xls)</li>
          <li>Files should follow the expected column structure</li>
          <li>Schedule file should have columns like "Day", "Site-ShiftType" (e.g., "AHG-MD1")</li>
          <li>Volume file should have: facility_name, Volume MD1, Volume MD2, Volume PM</li>
          <li>Contract file should have: Provider Name, Contract type, Shift preference, etc.</li>
          <li>Credentialing file should have: Provider, Credentialed Facilities</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminAnalyticsUpload;