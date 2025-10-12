import React from 'react';
import { LeaveRequest } from './types/schedule';
import './LeaveRequestsList.css';

interface LeaveRequestsListProps {
  requests: LeaveRequest[];
  userRole: 'physician' | 'hospital';
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onDelete?: (requestId: string) => void;
  onClose: () => void;
}

const LeaveRequestsList: React.FC<LeaveRequestsListProps> = ({
  requests,
  userRole,
  onApprove,
  onReject,
  onClose
}) => {
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="leave-request-overlay">
      <div className="leave-requests-modal">
        <div className="leave-requests-header">
          <h2>Leave Requests</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <div className="leave-requests-content">
          {pendingRequests.length === 0 && processedRequests.length === 0 ? (
            <div className="no-requests">
              <p>No leave requests found.</p>
            </div>
          ) : (
            <>
              {pendingRequests.length > 0 && (
                <div className="requests-section">
                  <h3>Pending Requests ({pendingRequests.length})</h3>
                  {pendingRequests.map(request => (
                    <div key={request.id} className="request-card pending">
                      <div className="request-header">
                        <div className="request-info">
                          <h4>{request.physicianName}</h4>
                          <p className="request-date">{formatDate(request.date)}</p>
                        </div>
                        <span className="status-badge pending">Pending</span>
                      </div>
                      
                      <div className="request-details">
                        <div className="detail-row">
                          <span className="detail-label">Shift:</span>
                          <span className="detail-value">{request.shiftType}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Site:</span>
                          <span className="detail-value">{request.siteName}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Reason:</span>
                          <span className="detail-value">{request.reason}</span>
                        </div>
                      </div>
                      
                      {userRole === 'hospital' && onApprove && onReject && (
                        <div className="request-actions">
                          <button 
                            onClick={() => onReject(request.id)}
                            className="reject-btn"
                          >
                            Reject
                          </button>
                          <button 
                            onClick={() => onApprove(request.id)}
                            className="approve-btn"
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {processedRequests.length > 0 && (
                <div className="requests-section">
                  <h3>Past Requests ({processedRequests.length})</h3>
                  {processedRequests.map(request => (
                    <div key={request.id} className={`request-card ${request.status}`}>
                      <div className="request-header">
                        <div className="request-info">
                          <h4>{request.physicianName}</h4>
                          <p className="request-date">{formatDate(request.date)}</p>
                        </div>
                        <span className={`status-badge ${request.status}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="request-details">
                        <div className="detail-row">
                          <span className="detail-label">Shift:</span>
                          <span className="detail-value">{request.shiftType}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Site:</span>
                          <span className="detail-value">{request.siteName}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Reason:</span>
                          <span className="detail-value">{request.reason}</span>
                        </div>
                        {request.respondedAt && (
                          <div className="detail-row">
                            <span className="detail-label">Responded:</span>
                            <span className="detail-value">
                              {new Date(request.respondedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
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

export default LeaveRequestsList;