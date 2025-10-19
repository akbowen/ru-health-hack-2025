import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const ComparisonChart = ({ forecastData }) => {
    // Combine all metrics into one dataset
    const combinedData = {};

    // Get all unique dates
    Object.entries(forecastData.data.historical_data).forEach(([metric, data]) => {
        data.forEach(point => {
            if (!combinedData[point.date]) {
                combinedData[point.date] = { date: point.date };
            }
            combinedData[point.date][metric] = point.value;
        });
    });

    // Add forecast data
    Object.entries(forecastData.data.forecast_data).forEach(([metric, data]) => {
        data.forEach(point => {
            if (!combinedData[point.date]) {
                combinedData[point.date] = { date: point.date };
            }
            combinedData[point.date][`${metric}_forecast`] = point.value;
        });
    });

    const chartData = Object.values(combinedData).sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const metrics = Object.keys(forecastData.data.historical_data);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="trend-chart-container" style={{ height: '500px' }}>
            <h3>All Metrics Comparison</h3>
            <ResponsiveContainer width="100%" height="90%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis label={{ value: 'Occupancy %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />

                    {metrics.map((metric, index) => (
                        <React.Fragment key={metric}>
                            <Line
                                type="monotone"
                                dataKey={metric}
                                stroke={colors[index]}
                                strokeWidth={2}
                                dot={false}
                                name={metric.split(' ').slice(-2).join(' ')}
                            />
                            <Line
                                type="monotone"
                                dataKey={`${metric}_forecast`}
                                stroke={colors[index]}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                name={`${metric.split(' ').slice(-2).join(' ')} (Forecast)`}
                            />
                        </React.Fragment>
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ComparisonChart;