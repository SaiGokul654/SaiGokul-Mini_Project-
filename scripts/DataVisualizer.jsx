import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
         LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const DataVisualizer = ({ data, chartType = 'bar', title = 'Data Visualization' }) => {
  const [processedData, setProcessedData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (data && data.length > 0) {
      processDataForChart();
    }
  }, [data, chartType]);

  const processDataForChart = () => {
    setLoading(true);
    try {
      let chartData = [];

      switch (chartType) {
        case 'bar':
          // Group data by diagnosis and count
          const diagnosisCount = data.reduce((acc, item) => {
            const diagnosis = item.diagnosis || 'Unknown';
            acc[diagnosis] = (acc[diagnosis] || 0) + 1;
            return acc;
          }, {});

          chartData = Object.entries(diagnosisCount).map(([name, value]) => ({
            name: name.length > 15 ? name.substring(0, 15) + '...' : name,
            value,
            fullName: name
          }));
          break;

        case 'line':
          // Time series data (assuming data has dates)
          const timeData = data
            .filter(item => item.admission_date)
            .sort((a, b) => new Date(a.admission_date) - new Date(b.admission_date))
            .slice(-20); // Last 20 records

          chartData = timeData.map((item, index) => ({
            date: new Date(item.admission_date).toLocaleDateString(),
            age: item.age || 0,
            bloodPressure: item.blood_pressure_systolic || 0
          }));
          break;

        case 'pie':
          // Age distribution
          const ageGroups = {
            '18-30': 0,
            '31-50': 0,
            '51-70': 0,
            '71+': 0
          };

          data.forEach(item => {
            const age = item.age || 0;
            if (age <= 30) ageGroups['18-30']++;
            else if (age <= 50) ageGroups['31-50']++;
            else if (age <= 70) ageGroups['51-70']++;
            else ageGroups['71+']++;
          });

          chartData = Object.entries(ageGroups).map(([name, value]) => ({
            name,
            value
          }));
          break;

        default:
          chartData = data.slice(0, 10).map((item, index) => ({
            name: `Item ${index + 1}`,
            value: item.age || Math.random() * 100
          }));
      }

      setProcessedData(chartData);
    } catch (error) {
      console.error('Error processing data for chart:', error);
      setProcessedData([]);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const renderChart = () => {
    if (loading) {
      return <div className="flex items-center justify-center h-64">Loading chart...</div>;
    }

    if (!processedData || processedData.length === 0) {
      return <div className="flex items-center justify-center h-64">No data available</div>;
    }

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [value, 'Count']}
                labelFormatter={(label) => processedData.find(d => d.name === label)?.fullName || label}
              />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="age" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="bloodPressure" stroke="#82ca9d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div className="data-visualizer p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      {renderChart()}
    </div>
  );
};

export default DataVisualizer;
