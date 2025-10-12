import React from 'react';
import { AvailabilityAlert } from './types/schedule';
import './AvailabilityAlertForm.css';

interface AvailabilityAlertFormProps {
  alerts: AvailabilityAlert[];
  userRole: 'physician' | 'hospital';
  physicianId?: string;
  onClaim?: (alertId: string) => void;
  onClose: () => void;
}

const AvailabilityAlertForm: React.FC<AvailabilityAlertFormProps> = ({
  alerts,
  userRole,
  physicianId,
  onClaim,
  onClose
}) => {
  const openAlerts = alerts.filter(a => a.status === 'open');
  const filledAlerts = alerts.filter(a => a.status === 'filled');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="availability-overlay">
      <div className="availability-modal">
        <div className="availability-header">
          <h2>Available Shifts</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <div className="availability-content">
          {openAlerts.length === 0 && filledAlerts.length === 0 ? (
            <div className="no-alerts">
              <p>No available shifts at this time.</p>
            </div>
          ) : (
            <>
              {openAlerts.length > 0 && (
                <div className="alerts-section">
                  <h3>Open Positions ({openAlerts.length})</h3>
                  {openAlerts.map(alert => (
                    <div key={alert.id} className="alert-card open">
                      <div className="alert-header">
                        <div className="alert-info">
                          <h4>{alert.siteName}</h4>
                          <p className="alert-date">{formatDate(alert.date)}</p>
                        </div>
                        <span className="shift-badge">{alert.shiftType}</span>
                      </div>
                      
                      <div className="alert-details">
                        <div className="detail-row">
                          <span className="detail-label">Replacing:</span>
                          <span className="detail-value">{alert.originalPhysicianName}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Posted:</span>
                          <span className="detail-value">
                            {new Date(alert.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      {userRole === 'physician' && onClaim && (
                        <div className="alert-actions">
                          <button 
                            onClick={() => onClaim(alert.id)}
                            className="claim-btn"
                          >
                            Claim This Shift
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {filledAlerts.length > 0 && (
                <div className="alerts-section">
                  <h3>Recently Filled ({filledAlerts.length})</h3>
                  {filledAlerts.map(alert => (
                    <div key={alert.id} className="alert-card filled">
                      <div className="alert-header">
                        <div className="alert-info">
                          <h4>{alert.siteName}</h4>
                          <p className="alert-date">{formatDate(alert.date)}</p>
                        </div>
                        <span className="shift-badge filled">{alert.shiftType}</span>
                      </div>
                      
                      <div className="alert-details">
                        <div className="detail-row">
                          <span className="detail-label">Original:</span>
                          <span className="detail-value">{alert.originalPhysicianName}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Filled By:</span>
                          <span className="detail-value">{alert.filledByName}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvailabilityAlertForm;