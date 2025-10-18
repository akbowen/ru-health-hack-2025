import React from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import './TrendChart.css';

const TrendChart = ({ metric, historicalData, forecastData, currentValue, predictedValue }) => {
    // Combine historical and forecast data
    const chartData = [
        ...historicalData.map(point => ({
            ...point,
            historical: point.value,
            forecast: null
        })),
        ...forecastData.map(point => ({
            ...point,
            historical: null,
            forecast: point.value
        }))
    ];

    // Add a connecting point between historical and forecast
    if (historicalData.length > 0 && forecastData.length > 0) {
        const lastHistorical = historicalData[historicalData.length - 1];
        chartData.splice(historicalData.length, 0, {
            date: lastHistorical.date,
            historical: lastHistorical.value,
            forecast: lastHistorical.value
        });
    }

    const formatMetricName = (metric) => {
        return metric
            .replace('percent icu beds occupied', 'ICU Beds Occupied')
            .replace('by covid-19 patients', '(COVID-19)')
            .replace('by influenza patients', '(Influenza)')
            .replace('by rsv patients', '(RSV)')
            .trim();
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            const isForecast = data.dataKey === 'forecast';

            return (
                <div className="custom-tooltip">
                    <p className="tooltip-date">{formatDate(label)}</p>
                    <p className="tooltip-value" style={{ color: isForecast ? '#f59e0b' : '#3b82f6' }}>
                        {isForecast ? 'Predicted: ' : 'Actual: '}
                        <strong>{data.value?.toFixed(2)}%</strong>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="trend-chart-container">
            <h3>{formatMetricName(metric)}</h3>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorHistorical" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        label={{ value: 'Occupancy %', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />

                    {/* Historical data */}
                    <Area
                        type="monotone"
                        dataKey="historical"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#colorHistorical)"
                        name="Historical"
                        connectNulls={false}
                    />

                    {/* Forecast data */}
                    <Area
                        type="monotone"
                        dataKey="forecast"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="url(#colorForecast)"
                        name="Forecast"
                        connectNulls={false}
                    />
                </AreaChart>
            </ResponsiveContainer>

            <div className="chart-stats">
                <div className="stat-item">
                    <span className="stat-label">Current</span>
                    <span className="stat-value">{currentValue?.toFixed(2)}%</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Predicted</span>
                    <span className="stat-value prediction">{predictedValue?.toFixed(2)}%</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Change</span>
                    <span
                        className={`stat-value ${predictedValue > currentValue ? 'increase' : 'decrease'}`}
                    >
                        {predictedValue > currentValue ? '↑' : '↓'}
                        {Math.abs(((predictedValue - currentValue) / currentValue * 100)).toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TrendChart;