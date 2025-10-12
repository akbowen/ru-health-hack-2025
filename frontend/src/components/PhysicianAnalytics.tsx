import React, { useState, useEffect, useCallback } from 'react';
import { Provider } from '../types/schedule';
import { api, ShiftCount, VolumeData, ComplianceReport } from '../utils/api';
import PhysicianSatisfaction from './PhysicianSatisfaction';
import './PhysicianAnalytics.css';

interface PhysicianAnalyticsProps {
  provider: Provider;
  username: string; // Add username prop
}

const PhysicianAnalytics: React.FC<PhysicianAnalyticsProps> = ({ provider, username }) => {
  const [activeTab, setActiveTab] = useState<'shifts' | 'volume' | 'compliance' | 'satisfaction'>('shifts');
  const [shiftData, setShiftData] = useState<ShiftCount | null>(null);
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shifts, volumes, compliance] = await Promise.all([
        api.getShiftCounts(),
        api.getVolumes(),
        api.getCompliance()
      ]);

      const myShiftData = shifts.find(s => s.doctor === provider.name);
      const myVolumeData = volumes.find(v => v.doctor === provider.name);
      const myComplianceData = compliance.find(c => c.provider_name === provider.name);

      setShiftData(myShiftData || null);
      setVolumeData(myVolumeData || null);
      setComplianceData(myComplianceData || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [provider.name]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="physician-analytics">
        <div className="loading-state">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="physician-analytics">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadAnalytics}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="physician-analytics">
      <div className="analytics-header">
        <h2>My Analytics</h2>
        <button onClick={loadAnalytics} className="refresh-btn">
          Refresh
        </button>
      </div>

      <div className="analytics-tabs">
        <button
          className={`tab-btn ${activeTab === 'shifts' ? 'active' : ''}`}
          onClick={() => setActiveTab('shifts')}
        >
          Shift Summary
        </button>
        <button
          className={`tab-btn ${activeTab === 'volume' ? 'active' : ''}`}
          onClick={() => setActiveTab('volume')}
        >
          Volume Tracking
        </button>
        <button
          className={`tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}
          onClick={() => setActiveTab('compliance')}
        >
          Contract Compliance
        </button>
        <button
          className={`tab-btn ${activeTab === 'satisfaction' ? 'active' : ''}`}
          onClick={() => setActiveTab('satisfaction')}
        >
          Satisfaction Score
        </button>
      </div>

      <div className="analytics-content">
        {activeTab === 'shifts' && (
          <ShiftSummaryView data={shiftData} />
        )}
        {activeTab === 'volume' && (
          <VolumeTrackingView data={volumeData} />
        )}
        {activeTab === 'compliance' && (
          <ComplianceView data={complianceData} />
        )}
        {activeTab === 'satisfaction' && (
          <PhysicianSatisfaction username={username} />
        )}
      </div>
    </div>
  );
};

// Shift Summary Component
const ShiftSummaryView: React.FC<{ data: ShiftCount | null }> = ({ data }) => {
  if (!data) {
    return <div className="no-data">No shift data available</div>;
  }

  return (
    <div className="shift-summary">
      <div className="summary-grid">
        <div className="summary-card total">
          <h3>Total Shifts</h3>
          <div className="big-number">{data.Total_Shifts}</div>
          <div className="breakdown">
            <span>Weekend: {data.Total_Weekend_Shifts}</span>
          </div>
        </div>

        <div className="summary-card md1">
          <h3>MD1 Shifts</h3>
          <div className="big-number">{data.MD1}</div>
          <div className="breakdown">
            <div className="breakdown-item">
              <span className="label">Weekday:</span>
              <span className="value">{data.MD1_Weekday}</span>
            </div>
            <div className="breakdown-item">
              <span className="label">Weekend:</span>
              <span className="value">{data.MD1_Weekend}</span>
            </div>
          </div>
        </div>

        <div className="summary-card md2">
          <h3>MD2 Shifts</h3>
          <div className="big-number">{data.MD2}</div>
          <div className="breakdown">
            <div className="breakdown-item">
              <span className="label">Weekday:</span>
              <span className="value">{data.MD2_Weekday}</span>
            </div>
            <div className="breakdown-item">
              <span className="label">Weekend:</span>
              <span className="value">{data.MD2_Weekend}</span>
            </div>
          </div>
        </div>

        <div className="summary-card pm">
          <h3>PM Shifts</h3>
          <div className="big-number">{data.PM}</div>
          <div className="breakdown">
            <div className="breakdown-item">
              <span className="label">Weekday:</span>
              <span className="value">{data.PM_Weekday}</span>
            </div>
            <div className="breakdown-item">
              <span className="label">Weekend:</span>
              <span className="value">{data.PM_Weekend}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <h3>Shift Distribution</h3>
        <div className="bar-chart">
          <div className="bar-group">
            <div className="bar-label">MD1</div>
            <div className="bar-container">
              <div 
                className="bar weekday" 
                style={{ width: `${(data.MD1_Weekday / data.Total_Shifts) * 100}%` }}
              >
                {data.MD1_Weekday > 0 && data.MD1_Weekday}
              </div>
              <div 
                className="bar weekend" 
                style={{ width: `${(data.MD1_Weekend / data.Total_Shifts) * 100}%` }}
              >
                {data.MD1_Weekend > 0 && data.MD1_Weekend}
              </div>
            </div>
          </div>

          <div className="bar-group">
            <div className="bar-label">MD2</div>
            <div className="bar-container">
              <div 
                className="bar weekday" 
                style={{ width: `${(data.MD2_Weekday / data.Total_Shifts) * 100}%` }}
              >
                {data.MD2_Weekday > 0 && data.MD2_Weekday}
              </div>
              <div 
                className="bar weekend" 
                style={{ width: `${(data.MD2_Weekend / data.Total_Shifts) * 100}%` }}
              >
                {data.MD2_Weekend > 0 && data.MD2_Weekend}
              </div>
            </div>
          </div>

          <div className="bar-group">
            <div className="bar-label">PM</div>
            <div className="bar-container">
              <div 
                className="bar weekday" 
                style={{ width: `${(data.PM_Weekday / data.Total_Shifts) * 100}%` }}
              >
                {data.PM_Weekday > 0 && data.PM_Weekday}
              </div>
              <div 
                className="bar weekend" 
                style={{ width: `${(data.PM_Weekend / data.Total_Shifts) * 100}%` }}
              >
                {data.PM_Weekend > 0 && data.PM_Weekend}
              </div>
            </div>
          </div>
        </div>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-color weekday"></span>
            <span>Weekday</span>
          </div>
          <div className="legend-item">
            <span className="legend-color weekend"></span>
            <span>Weekend</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Volume Tracking Component
const VolumeTrackingView: React.FC<{ data: VolumeData | null }> = ({ data }) => {
  if (!data) {
    return <div className="no-data">No volume data available</div>;
  }

  const maxVolume = Math.max(data.MD1_Volume, data.MD2_Volume, data.PM_Volume);

  return (
    <div className="volume-tracking">
      <div className="volume-summary">
        <div className="volume-card total">
          <h3>Total Volume</h3>
          <div className="big-number">{data.Total_Volume.toFixed(2)}</div>
        </div>

        <div className="volume-grid">
          <div className="volume-card">
            <h4>MD1 Volume</h4>
            <div className="volume-number">{data.MD1_Volume.toFixed(2)}</div>
            {data.NC_Shifts_MD1 > 0 && (
              <div className="nc-info">+ {data.NC_Shifts_MD1} NC shifts</div>
            )}
          </div>

          <div className="volume-card">
            <h4>MD2 Volume</h4>
            <div className="volume-number">{data.MD2_Volume.toFixed(2)}</div>
            {data.NC_Shifts_MD2 > 0 && (
              <div className="nc-info">+ {data.NC_Shifts_MD2} NC shifts</div>
            )}
          </div>

          <div className="volume-card">
            <h4>PM Volume</h4>
            <div className="volume-number">{data.PM_Volume.toFixed(2)}</div>
            {data.NC_Shifts_PM > 0 && (
              <div className="nc-info">+ {data.NC_Shifts_PM} NC shifts</div>
            )}
          </div>
        </div>
      </div>

      <div className="volume-chart">
        <h3>Volume by Shift Type</h3>
        <div className="horizontal-bar-chart">
          <div className="h-bar-item">
            <div className="h-bar-label">MD1</div>
            <div className="h-bar-wrapper">
              <div 
                className="h-bar md1-bar"
                style={{ width: `${(data.MD1_Volume / maxVolume) * 100}%` }}
              >
                <span className="h-bar-value">{data.MD1_Volume.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="h-bar-item">
            <div className="h-bar-label">MD2</div>
            <div className="h-bar-wrapper">
              <div 
                className="h-bar md2-bar"
                style={{ width: `${(data.MD2_Volume / maxVolume) * 100}%` }}
              >
                <span className="h-bar-value">{data.MD2_Volume.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="h-bar-item">
            <div className="h-bar-label">PM</div>
            <div className="h-bar-wrapper">
              <div 
                className="h-bar pm-bar"
                style={{ width: `${(data.PM_Volume / maxVolume) * 100}%` }}
              >
                <span className="h-bar-value">{data.PM_Volume.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Compliance View Component
const ComplianceView: React.FC<{ data: ComplianceReport | null }> = ({ data }) => {
  if (!data) {
    return <div className="no-data">No compliance data available</div>;
  }

  const getStatusClass = (remaining: string | number): string => {
    if (typeof remaining === 'string') {
      if (remaining === 'Allowed' || remaining === 'No limit') return 'status-good';
      return 'status-neutral';
    }
    return remaining < 0 ? 'status-warning' : 'status-good';
  };

  const formatRemaining = (remaining: string | number): string => {
    if (typeof remaining === 'string') return remaining;
    return remaining < 0 ? `Exceeded by ${Math.abs(remaining)}` : `${remaining} remaining`;
  };

  return (
    <div className="compliance-view">
      <div className="compliance-header-info">
        <div className="info-row">
          <span className="label">Contract Type:</span>
          <span className="value">{data.contract_type}</span>
        </div>
        <div className="info-row">
          <span className="label">Shift Preferences:</span>
          <span className="value">{data.shift_preferences}</span>
        </div>
      </div>

      <div className="compliance-cards">
        <div className="compliance-card">
          <h3>Total Shifts</h3>
          <div className="compliance-stats">
            <div className="stat-item">
              <span className="stat-label">Actual:</span>
              <span className="stat-value">{data.Total_Actual}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Limit:</span>
              <span className="stat-value">{data.Total_Limit}</span>
            </div>
            <div className={`stat-item ${getStatusClass(data.Total_Remaining)}`}>
              <span className="stat-label">Status:</span>
              <span className="stat-value">{formatRemaining(data.Total_Remaining)}</span>
            </div>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${Math.min((data.Total_Actual / (typeof data.Total_Limit === 'number' ? data.Total_Limit : data.Total_Actual)) * 100, 100)}%` 
              }}
            />
          </div>
        </div>

        <div className="compliance-card">
          <h3>Weekend Shifts</h3>
          <div className="compliance-stats">
            <div className="stat-item">
              <span className="stat-label">Actual:</span>
              <span className="stat-value">{data.Weekend_Actual}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Limit:</span>
              <span className="stat-value">{data.Weekend_Limit}</span>
            </div>
            <div className={`stat-item ${getStatusClass(data.Weekend_Remaining)}`}>
              <span className="stat-label">Status:</span>
              <span className="stat-value">{formatRemaining(data.Weekend_Remaining)}</span>
            </div>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${Math.min((data.Weekend_Actual / (typeof data.Weekend_Limit === 'number' ? data.Weekend_Limit : data.Weekend_Actual)) * 100, 100)}%` 
              }}
            />
          </div>
        </div>
      </div>

      <div className="shift-type-compliance">
        <h3>Shift Type Compliance</h3>
        <table className="compliance-table">
          <thead>
            <tr>
              <th>Shift Type</th>
              <th>Actual</th>
              <th>Limit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MD1</td>
              <td>{data.MD1_Actual}</td>
              <td>{typeof data.MD1_Remaining === 'string' ? '∞' : '-'}</td>
              <td className={getStatusClass(data.MD1_Remaining)}>
                {formatRemaining(data.MD1_Remaining)}
              </td>
            </tr>
            <tr>
              <td>MD2</td>
              <td>{data.MD2_Actual}</td>
              <td>{typeof data.MD2_Remaining === 'string' ? '∞' : '-'}</td>
              <td className={getStatusClass(data.MD2_Remaining)}>
                {formatRemaining(data.MD2_Remaining)}
              </td>
            </tr>
            <tr>
              <td>PM</td>
              <td>{data.PM_Actual}</td>
              <td>{data.PM_Limit}</td>
              <td className={getStatusClass(data.PM_Remaining)}>
                {formatRemaining(data.PM_Remaining)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PhysicianAnalytics;