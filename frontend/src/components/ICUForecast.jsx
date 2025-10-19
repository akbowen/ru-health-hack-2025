import React, { useState, useEffect } from 'react';
import TrendChart from './TrendChart';
import './ICUForecast.css';
import ComparisonChart from './ComparisonChart';

const ICUForecast = () => {
    const [selectedState, setSelectedState] = useState('NJ');
    const [weeks, setWeeks] = useState(1);
    const [forecastData, setForecastData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [states, setStates] = useState([]);
    const [viewMode, setViewMode] = useState('charts'); // 'charts' or 'cards'

    // Fetch available states on mount
    useEffect(() => {
        fetch('http://localhost:4000/api/health/states')
            .then(res => res.json())
            .then(data => {
                console.log(">>", data)
                if (data.success) {
                    setStates(data.states);
                }
            })
            .catch(err => console.error('Error fetching states:', err));
    }, []);

    // Fetch forecast data
    const fetchForecast = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `http://localhost:4000/api/health/forecast/${selectedState}?weeks=${weeks}`
            );


            console.log("response", response)
            const data = await response.json();

            console.log("data", data)

            if (data.success) {
                setForecastData(data);
            } else {
                setError(data.error || 'Failed to fetch forecast');
            }
        } catch (err) {
            setError('Failed to connect to server. Make sure backend is running.');
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchForecast();
    }, [selectedState, weeks]);

    const formatMetricName = (metric) => {
        return metric
            .replace('percent icu beds occupied', 'ICU Beds Occupied')
            .replace('by covid-19 patients', '(COVID-19)')
            .replace('by influenza patients', '(Influenza)')
            .replace('by rsv patients', '(RSV)')
            .trim();
    };

    const getChangeColor = (change) => {
        if (change > 5) return '#ef4444';
        if (change > 0) return '#f59e0b';
        if (change > -5) return '#10b981';
        return '#059669';
    };

    return (
        <div className="forecast-container">
            <h1>🏥 ICU Bed Occupancy Forecast</h1>

            {/* Controls */}
            <div className="controls">
                <div className="control-group">
                    <label>State:</label>
                    <select
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                    >
                        {states.map(state => (
                            <option key={state} value={state}>{state}</option>
                        ))}
                    </select>
                </div>

                <div className="control-group">
                    <label>Weeks Ahead:</label>
                    <select
                        value={weeks}
                        onChange={(e) => setWeeks(parseInt(e.target.value))}
                    >
                        <option value={1}>1 Week</option>
                        <option value={2}>2 Weeks</option>
                        <option value={3}>3 Weeks</option>
                        <option value={4}>4 Weeks</option>
                    </select>
                </div>

                <div className="control-group">
                    <label>View:</label>
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                    >
                        <option value="charts">Trend Charts</option>
                        <option value="cards">Summary Cards</option>
                    </select>
                </div>
            </div>

            {/* Loading */}
            {loading && <div className="loading">Loading forecast...</div>}

            {/* Error */}
            {error && <div className="error">{error}</div>}

            {/* Results */}
            {forecastData && forecastData.success && (
                <div className="results">
                    <div className="results-header">
                        <h2>Forecast for {forecastData.state}</h2>
                        <p className="timestamp">
                            Generated: {new Date(forecastData.timestamp).toLocaleString()}
                        </p>
                    </div>

                    {/* Trend Charts View */}
                    {viewMode === 'charts' && (
                        <div className="charts-view">
                            {Object.entries(forecastData.data.historical_data).map(([metric]) => (
                                <TrendChart
                                    key={metric}
                                    metric={metric}
                                    historicalData={forecastData.data.historical_data[metric]}
                                    forecastData={forecastData.data.forecast_data[metric] || []}
                                    currentValue={forecastData.data.current_values[metric]}
                                    predictedValue={forecastData.data.predicted_values[metric]}
                                />
                            ))}
                        </div>
                    )}

                    {/* // Add this option to viewMode select: */}


                    {/* Summary Cards View */}
                    {/* {viewMode === 'cards' && (
                        <div className="metrics-grid">
                            {Object.entries(forecastData.data.predicted_changes).map(([metric, change]) => {
                                const currentValue = forecastData.data.current_values[metric];
                                const predictedValue = forecastData.data.predicted_values[metric];

                                return (
                                    <div key={metric} className="metric-card">
                                        <h3>{formatMetricName(metric)}</h3>

                                        <div className="metric-values">
                                            <div className="value-item">
                                                <span className="label">Current:</span>
                                                <span className="value">{currentValue?.toFixed(2)}%</span>
                                            </div>

                                            <div className="value-item">
                                                <span className="label">Predicted:</span>
                                                <span className="value">{predictedValue?.toFixed(2)}%</span>
                                            </div>
                                        </div>

                                        <div
                                            className="change-indicator"
                                            style={{ backgroundColor: getChangeColor(change) }}
                                        >
                                            <span className="change-value">
                                                {change > 0 ? '+' : ''}{change.toFixed(2)}%
                                            </span>
                                            <span className="change-label">Expected Change</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )} */}
                    {viewMode === 'comparison' && (
                        <>
                            <option value="comparison">Multi-Metric Comparison</option>
                            <ComparisonChart forecastData={forecastData} />
                        </>

                    )}
                </div>
            )}
        </div>
    );
};

export default ICUForecast;