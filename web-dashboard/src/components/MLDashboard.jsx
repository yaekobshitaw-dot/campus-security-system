// src/components/MLDashboard.jsx
import React, { useState, useEffect } from 'react';
import mlService from '../services/mlService';

const MLDashboard = ({ incidents }) => {
  const [predictions, setPredictions] = useState([]);
  const [hotzones, setHotzones] = useState([]);
  const [mlHealth, setMlHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMLData();
  }, [incidents]);

  const loadMLData = async () => {
    try {
      setLoading(true);
      setError('');

      // Check ML health
      const health = await mlService.health();
      setMlHealth(health);

      // Get hotzones
      const hotzoneData = await mlService.detectHotzones();
      if (hotzoneData) {
        setHotzones(hotzoneData.hotzones || []);
      }

      // Predict risk for each incident
      if (incidents && incidents.length > 0) {
        const predictionsData = await Promise.all(
          incidents.slice(0, 5).map(async (incident) => {
            const prediction = await mlService.predictRisk({
              type: incident.type,
              description: incident.description || '',
              severity: incident.severity,
              location: incident.location_name || ''
            });
            return { ...incident, prediction };
          })
        );
        setPredictions(predictionsData);
      }
    } catch (error) {
      console.error('ML data loading error:', error);
      setError('ML Service not available');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0'
    };
    return colors[risk] || '#999';
  };

  const getRiskEmoji = (risk) => {
    const emojis = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      critical: '🟣'
    };
    return emojis[risk] || '⚪';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h3>🤖 ML Dashboard</h3>
        <p style={styles.loadingText}>Loading ML predictions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h3>🤖 ML Dashboard</h3>
        <div style={styles.error}>
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={loadMLData} style={styles.retryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>🤖 ML Dashboard</h3>
        <span style={styles.statusBadge}>
          {mlHealth?.status === 'healthy' ? '🟢 Online' : '🔴 Offline'}
        </span>
      </div>

      {/* Hotzones */}
      <div style={styles.section}>
        <h4>📍 High-Risk Areas</h4>
        {hotzones.length === 0 ? (
          <p style={styles.emptyText}>No hotzones detected</p>
        ) : (
          <div style={styles.hotzoneGrid}>
            {hotzones.map((zone, index) => (
              <div key={index} style={styles.hotzoneCard}>
                <div style={styles.hotzoneHeader}>
                  <span style={styles.hotzoneName}>{zone.location}</span>
                  <span style={{...styles.riskBadge, backgroundColor: getRiskColor(zone.risk_score >= 0.7 ? 'high' : 'medium')}}>
                    {Math.round(zone.risk_score * 100)}%
                  </span>
                </div>
                <div style={styles.hotzoneDetails}>
                  <span>📊 {zone.incident_count} incidents</span>
                  <span>📌 {zone.incident_types?.join(', ') || 'Various'}</span>
                </div>
                <div style={styles.riskBar}>
                  <div style={{...styles.riskBarFill, width: (zone.risk_score * 100) + '%', backgroundColor: getRiskColor(zone.risk_score >= 0.7 ? 'high' : 'medium')}} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incident Predictions */}
      <div style={styles.section}>
        <h4>🔮 Risk Predictions</h4>
        {predictions.length === 0 ? (
          <p style={styles.emptyText}>No predictions available</p>
        ) : (
          predictions.map((item) => (
            item.prediction && (
              <div key={item.incident_id} style={styles.predictionCard}>
                <div style={styles.predictionHeader}>
                  <span style={styles.predictionType}>{item.type.toUpperCase()}</span>
                  <span style={{...styles.riskBadge, backgroundColor: getRiskColor(item.prediction.risk_level)}}>
                    {getRiskEmoji(item.prediction.risk_level)} {item.prediction.risk_level}
                  </span>
                </div>
                <div style={styles.predictionBody}>
                  <p>{item.description || 'No description'}</p>
                  <div style={styles.predictionDetails}>
                    <span>🎯 Confidence: {Math.round(item.prediction.confidence * 100)}%</span>
                    <span>⏱️ Response: {item.prediction.estimated_response_time} min</span>
                  </div>
                  <div style={styles.actionBox}>
                    <span>📋 {item.prediction.suggested_action}</span>
                  </div>
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginTop: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32'
  },
  section: {
    marginBottom: '20px'
  },
  hotzoneGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  },
  hotzoneCard: {
    backgroundColor: '#f5f5f5',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  hotzoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  hotzoneName: {
    fontWeight: 'bold',
    fontSize: '14px'
  },
  hotzoneDetails: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#666',
    marginBottom: '8px',
    flexWrap: 'wrap'
  },
  riskBar: {
    height: '4px',
    backgroundColor: '#e0e0e0',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  riskBarFill: {
    height: '100%',
    transition: 'width 1s ease'
  },
  predictionCard: {
    backgroundColor: '#f5f5f5',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '10px',
    border: '1px solid #e0e0e0'
  },
  predictionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  predictionType: {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#2196F3'
  },
  riskBadge: {
    padding: '2px 10px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  predictionBody: {
    fontSize: '14px'
  },
  predictionDetails: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#666',
    marginTop: '6px'
  },
  actionBox: {
    backgroundColor: '#e3f2fd',
    padding: '8px 12px',
    borderRadius: '6px',
    marginTop: '8px',
    fontSize: '12px',
    color: '#1565C0'
  },
  loadingText: {
    textAlign: 'center',
    color: '#999',
    padding: '20px'
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: '10px'
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '15px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  retryBtn: {
    backgroundColor: '#c62828',
    color: 'white',
    border: 'none',
    padding: '6px 16px',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default MLDashboard;
