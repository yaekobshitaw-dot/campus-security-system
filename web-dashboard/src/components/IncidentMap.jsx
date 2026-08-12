// src/components/IncidentMap.jsx
import React from 'react';

const IncidentMap = ({ incidents }) => {
  return (
    <div style={styles.container}>
      <div style={styles.mapPlaceholder}>
        <span style={styles.mapIcon}>🗺️</span>
        <p>Interactive Map</p>
        <p style={styles.mapSubtext}>Showing {incidents?.length || 0} incidents</p>
      </div>
    </div>
  );
};

const styles = {
  container: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginTop: '20px', height: '200px' },
  mapPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#f0f4f8', borderRadius: '8px' },
  mapIcon: { fontSize: '48px' },
  mapSubtext: { color: '#999', fontSize: '14px' }
};

export default IncidentMap;
