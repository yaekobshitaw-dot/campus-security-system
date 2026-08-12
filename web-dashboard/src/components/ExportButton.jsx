// src/components/ExportButton.jsx
import React from 'react';

const ExportButton = ({ onExport, type = 'csv' }) => {
  return (
    <button onClick={onExport} style={styles.button}>
      📁 Export {type.toUpperCase()}
    </button>
  );
};

const styles = {
  button: {
    background: '#2196F3',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }
};

export default ExportButton;
