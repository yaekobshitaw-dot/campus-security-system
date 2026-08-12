// src/components/Analytics/AnalyticsCharts.jsx
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

const AnalyticsCharts = ({ incidents }) => {
  const [typeData, setTypeData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    if (incidents && incidents.length > 0) {
      processData();
    }
  }, [incidents]);

  const processData = () => {
    // Type data
    const typeCount = {};
    incidents.forEach(inc => {
      typeCount[inc.type] = (typeCount[inc.type] || 0) + 1;
    });
    setTypeData(Object.entries(typeCount).map(([name, value]) => ({ name: name.toUpperCase(), value })));

    // Status data
    const statusCount = {};
    incidents.forEach(inc => {
      statusCount[inc.status] = (statusCount[inc.status] || 0) + 1;
    });
    setStatusData(Object.entries(statusCount).map(([name, value]) => ({ name, value })));

    // Monthly data
    const months = {};
    incidents.forEach(inc => {
      const month = new Date(inc.created_at).toLocaleString('default', { month: 'short' });
      months[month] = (months[month] || 0) + 1;
    });
    setMonthlyData(Object.entries(months).map(([name, count]) => ({ name, count })));
  };

  const COLORS = ['#2196F3', '#FF9800', '#F44336', '#4CAF50', '#9C27B0'];

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📊 Analytics Dashboard</h3>
      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <h4>Incident Types</h4>
          <PieChart width={300} height={250}>
            <Pie data={typeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
              {typeData.map((entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </div>
        <div style={styles.chartCard}>
          <h4>Incident Status</h4>
          <BarChart width={300} height={250} data={statusData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#2196F3" />
          </BarChart>
        </div>
        <div style={styles.chartCard}>
          <h4>Monthly Trends</h4>
          <AreaChart width={300} height={250} data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="#2196F3" fill="#2196F3" fillOpacity={0.3} />
          </AreaChart>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginTop: '20px' },
  title: { marginBottom: '20px', color: '#333' },
  chartGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' },
  chartCard: { padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', textAlign: 'center' }
};

export default AnalyticsCharts;
