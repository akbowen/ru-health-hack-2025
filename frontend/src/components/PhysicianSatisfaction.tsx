import React, { useState, useEffect } from 'react';
import { api, SatisfactionData } from '../utils/api';
import './PhysicianSatisfaction.css';

interface PhysicianSatisfactionProps {
  username: string;
}

const PhysicianSatisfaction: React.FC<PhysicianSatisfactionProps> = ({ username }) => {
  const [data, setData] = useState<SatisfactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [happinessRating, setHappinessRating] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSatisfactionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const loadSatisfactionData = async () => {
    setLoading(true);
    try {
      const result = await api.getSatisfaction(username);
      setData(result);
      if (result.happinessRating) {
        setHappinessRating(result.happinessRating);
      }
      if (result.feedback) {
        setFeedback(result.feedback);
      }
    } catch (err: any) {
      console.error('Failed to load satisfaction data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await api.updateHappinessRating(username, happinessRating, feedback);
      setMessage('Your feedback has been saved!');
      await loadSatisfactionData();
    } catch (err: any) {
      setMessage('Failed to save feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Attention';
  };

  if (loading) {
    return <div className="satisfaction-loading">Loading satisfaction analysis...</div>;
  }

  if (!data) {
    return <div className="satisfaction-error">Unable to load satisfaction data</div>;
  }

  return (
    <div className="physician-satisfaction">
      <h2>Schedule Satisfaction Analysis</h2>

      {/* Overall Score */}
      <div className="overall-score-card">
        <h3>Overall Satisfaction Score</h3>
        <div 
          className="score-circle"
          style={{ borderColor: getScoreColor(data.satisfaction.overallScore) }}
        >
          <div className="score-number">{data.satisfaction.overallScore}</div>
          <div className="score-max">/10</div>
        </div>
        <div 
          className="score-label"
          style={{ color: getScoreColor(data.satisfaction.overallScore) }}
        >
          {getScoreLabel(data.satisfaction.overallScore)}
        </div>
      </div>

      {/* Consecutive Shifts Analysis */}
      <div className="consecutive-shifts-card">
        <h3>Consecutive Shifts Analysis</h3>
        <div className="consecutive-stats">
          <div className="stat">
            <span className="stat-label">Max Consecutive Days:</span>
            <span className="stat-value">{data.consecutiveData.maxConsecutive} days</span>
          </div>
          <div className="stat">
            <span className="stat-label">Total Working Days:</span>
            <span className="stat-value">{data.consecutiveData.workDays} / {data.consecutiveData.totalDays}</span>
          </div>
        </div>

        {data.consecutiveData.consecutiveGroups.length > 0 && (
          <div className="consecutive-groups">
            <h4>Consecutive Work Periods:</h4>
            <ul>
              {data.consecutiveData.consecutiveGroups.map((group: { startDate: string; endDate: string; count: number }, index: number) => (
                <li key={index}>
                  <span className="group-dates">{group.startDate} - {group.endDate}</span>
                  <span className={`group-count ${group.count >= 5 ? 'warning' : ''}`}>
                    {group.count} consecutive days
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Satisfaction Breakdown */}
      <div className="satisfaction-breakdown">
        <h3>Score Breakdown</h3>
        
        {Object.entries(data.satisfaction.breakdown).map(([key, value]) => {
          const labels: { [key: string]: string } = {
            workloadBalance: 'Workload Balance',
            weekendBurden: 'Weekend Distribution',
            consecutiveShifts: 'Consecutive Shifts',
            contractCompliance: 'Contract Compliance',
            selfReported: 'Your Rating'
          };

          const typedValue = value as { score: number; weight: number; weighted: number };

          return (
            <div key={key} className="breakdown-item">
              <div className="breakdown-header">
                <span className="breakdown-label">{labels[key]}</span>
                <span className="breakdown-score">{typedValue.score}/10</span>
              </div>
              <div className="breakdown-bar-container">
                <div 
                  className="breakdown-bar"
                  style={{ 
                    width: `${typedValue.score * 10}%`,
                    backgroundColor: getScoreColor(typedValue.score)
                  }}
                />
              </div>
              <div className="breakdown-weight">
                Weight: {(typedValue.weight * 100).toFixed(0)}% | 
                Weighted Score: {typedValue.weighted.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Happiness Rating Input */}
      <div className="happiness-rating-card">
        <h3>How Happy Are You With Your Current Schedule?</h3>
        <p className="rating-subtitle">Your rating contributes 10% to your overall satisfaction score</p>
        
        <div className="rating-selector">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
            <button
              key={num}
              className={`rating-btn ${happinessRating === num ? 'selected' : ''}`}
              onClick={() => setHappinessRating(num)}
              disabled={submitting}
            >
              {num}
            </button>
          ))}
        </div>

        <div className="rating-labels">
          <span>Very Unhappy</span>
          <span>Neutral</span>
          <span>Very Happy</span>
        </div>

        <textarea
          className="feedback-textarea"
          placeholder="Optional: Share any specific concerns or feedback about your schedule..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          disabled={submitting}
          rows={4}
        />

        <button
          className="submit-rating-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Save My Feedback'}
        </button>

        {message && (
          <div className={`feedback-message ${message.includes('saved') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="recommendations-card">
        <h3>💡 Insights</h3>
        <ul className="recommendations-list">
          {data.satisfaction.breakdown.consecutiveShifts.score < 7 && (
            <li className="warning">
              You have {data.consecutiveData.maxConsecutive} consecutive working days. 
              Consider requesting breaks to avoid burnout.
            </li>
          )}
          {data.satisfaction.breakdown.weekendBurden.score < 7 && (
            <li className="warning">
              Your weekend shift ratio may be higher than ideal. Discuss with scheduling.
            </li>
          )}
          {data.satisfaction.breakdown.workloadBalance.score < 7 && (
            <li className="warning">
              Your total shift count differs from the recommended workload.
            </li>
          )}
          {data.satisfaction.overallScore >= 8 && (
            <li className="success">
              Your schedule is well-balanced! Keep up the great work.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PhysicianSatisfaction;