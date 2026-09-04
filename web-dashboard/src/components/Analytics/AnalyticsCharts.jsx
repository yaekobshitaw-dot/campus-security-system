// src/components/Analytics/AnalyticsCharts.jsx
import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';

const AnalyticsCharts = ({ incidents }) => {
  const [typeData, setTypeData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  const formatIncidentType = (value = '') => {
    const label = String(value).replace(/[_-]+/g, ' ').trim();
    if (!label) return 'Other';
    return label.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatStatus = (value = '') => String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  useEffect(() => {
    if (incidents && incidents.length > 0) {
      processData();
    }
  }, [incidents]);

  const processData = () => {
    const typeCount = {};
    incidents.forEach((inc) => {
      const key = inc.type || 'other';
      typeCount[key] = (typeCount[key] || 0) + 1;
    });
    setTypeData(Object.entries(typeCount).map(([name, value]) => ({ name: formatIncidentType(name), value })));

    const statusCount = {};
    incidents.forEach((inc) => {
      const key = inc.status || 'reported';
      statusCount[key] = (statusCount[key] || 0) + 1;
    });
    setStatusData(Object.entries(statusCount).map(([name, value]) => ({ name: formatStatus(name), value })));

    const months = {};
    incidents.forEach((inc) => {
      const month = new Date(inc.created_at).toLocaleString('default', { month: 'short' });
      months[month] = (months[month] || 0) + 1;
    });
    setMonthlyData(Object.entries(months).map(([name, count]) => ({ name, count })));
  };

  const COLORS = ['#58d6ff', '#ffbf69', '#ff7a7a', '#56d4a7', '#8df0d4'];

  const pieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (!name || Number(percent) <= 0) return null;

    return (
      <text x={x} y={y} fill="#edf6ff" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="central">
        {name}
      </text>
    );
  };

  return (
    <div className="analytics-panel-shell">
      <h3 className="analytics-panel-title">📊 Analytics Dashboard</h3>
      <div className="analytics-chart-grid">
        <div className="analytics-chart-card">
          <h4>Incident Types</h4>
          <PieChart width={320} height={260}>
            <Pie
              data={typeData}
              cx="50%"
              cy="50%"
              outerRadius={82}
              innerRadius={36}
              dataKey="value"
              nameKey="name"
              label={pieLabel}
              labelLine={false}
              stroke="rgba(255,255,255,0.08)"
            >
              {typeData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value}`, 'Incidents']}
              contentStyle={{ backgroundColor: '#0f1e2b', border: '1px solid rgba(103,215,255,0.2)', borderRadius: 12, color: '#edf6ff' }}
              labelStyle={{ color: '#edf6ff', fontWeight: 700 }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(value) => <span style={{ color: '#dfeaf6', fontSize: 14, fontWeight: 600 }}>{value}</span>}
            />
          </PieChart>
        </div>

        <div className="analytics-chart-card">
          <h4>Incident Status</h4>
          <BarChart width={320} height={260} data={statusData}>
            <CartesianGrid stroke="rgba(156, 177, 196, 0.22)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#dfeaf6', fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#dfeaf6', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`${value}`, 'Count']}
              contentStyle={{ backgroundColor: '#0f1e2b', border: '1px solid rgba(103,215,255,0.2)', borderRadius: 12, color: '#edf6ff' }}
              labelStyle={{ color: '#edf6ff', fontWeight: 700 }}
            />
            <Bar dataKey="value" fill="#67d7ff" radius={[8, 8, 0, 0]} />
          </BarChart>
        </div>

        <div className="analytics-chart-card">
          <h4>Monthly Trends</h4>
          <AreaChart width={320} height={260} data={monthlyData}>
            <CartesianGrid stroke="rgba(156, 177, 196, 0.22)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#dfeaf6', fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#dfeaf6', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`${value}`, 'Incidents']}
              contentStyle={{ backgroundColor: '#0f1e2b', border: '1px solid rgba(103,215,255,0.2)', borderRadius: 12, color: '#edf6ff' }}
              labelStyle={{ color: '#edf6ff', fontWeight: 700 }}
            />
            <Area type="monotone" dataKey="count" stroke="#67d7ff" fill="#67d7ff" fillOpacity={0.28} strokeWidth={3} />
          </AreaChart>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
