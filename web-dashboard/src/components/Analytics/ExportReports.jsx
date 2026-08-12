// src/components/Analytics/ExportReports.jsx
import React from 'react';

const ExportReports = ({ incidents }) => {
  const exportCSV = () => {
    const csv = ['Type,Severity,Status,Location,Date'];
    incidents.forEach(inc => {
      csv.push(inc.type + ',' + inc.severity + ',' + inc.status + ',' + (inc.location_name || 'Unknown') + ',' + new Date(inc.created_at).toLocaleDateString());
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incidents.csv';
    a.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(incidents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incidents.json';
    a.click();
  };

  return (
    <div style={styles.container}>
      <h4>📁 Export Reports</h4>
      <div style={styles.buttonGroup}>
        <button onClick={exportCSV} style={styles.button}>📊 Export CSV</button>
        <button onClick={exportJSON} style={styles.button}>📋 Export JSON</button>
        <button onClick={() => window.print()} style={styles.button}>🖨️ Print</button>
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '15px', backgroundColor: 'white', borderRadius: '8px' },
  buttonGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' },
  button: { backgroundColor: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }
};

export default ExportReports;
