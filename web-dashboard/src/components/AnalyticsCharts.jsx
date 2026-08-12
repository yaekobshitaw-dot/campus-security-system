// src/components/AnalyticsCharts.jsx
import React, { useEffect, useState } from 'react';

const AnalyticsCharts = ({ incidents }) => {
  const [statusData, setStatusData] = useState([]);
  const [typeData, setTypeData] = useState([]);

  useEffect(() => {
    if (incidents && incidents.length > 0) {
      processData();
    }
  }, [incidents]);

  const processData = () => {
    const statusCount = {};
    incidents.forEach(inc => {
      statusCount[inc.status] = (statusCount[inc.status] || 0) + 1;
    });
    setStatusData(Object.entries(statusCount).map(([name, value]) => ({ name, value })));
  };

  return (
    <div style={styles.container}>
      <h3>📊 Analytics</h3>
      <p>Total Incidents: {incidents?.length || 0}</p>
      <div style={styles.stats}>
        {statusData.map((item, index) => (
          <div key={index} style={styles.statItem}>
            <span style={styles.statName}>{item.name}</span>
            <span style={styles.statValue}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginTop: '20px' },
  stats: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  statItem: { backgroundColor: '#f5f5f5', padding: '10px 20px', borderRadius: '8px' },
  statName: { fontWeight: 'bold', marginRight: '10px' },
  statValue: { color: '#2196F3', fontWeight: 'bold' }
};

export default AnalyticsCharts;
