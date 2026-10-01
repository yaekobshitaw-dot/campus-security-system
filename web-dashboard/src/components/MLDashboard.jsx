// src/components/MLDashboard.jsx
import React, { useState, useEffect } from 'react';
import mlService from '../services/mlService';

const normalizeLocationName = (name) => String(name || '').trim().toLocaleLowerCase();

const getIncidentId = (incident) => {
  const value = incident?.incident_id ?? incident?.id;
  return value === null || value === undefined || !String(value).trim() ? null : String(value).trim();
};

const getUniqueIncidents = (incidents) => {
  const seenIds = new Set();
  return (Array.isArray(incidents) ? incidents : []).filter((incident) => {
    if (!incident || typeof incident !== 'object') return false;
    const incidentId = getIncidentId(incident);
    if (!incidentId) return true;
    if (seenIds.has(incidentId)) return false;
    seenIds.add(incidentId);
    return true;
  });
};

const incidentsAtLocation = (incidents, location) => {
  const normalizedName = normalizeLocationName(location?.name);
  const locationId = location?.location_id == null ? null : String(location.location_id);
  return incidents.filter((incident) => {
    const incidentLocationId = incident.campus_location_id ?? incident.campus_location?.location_id;
    if (locationId && incidentLocationId != null && String(incidentLocationId) === locationId) return true;
    if (!normalizedName) return false;
    return [
      incident.location_name,
      incident.building,
      incident.campus_location?.name
    ].some((name) => normalizeLocationName(name) === normalizedName);
  });
};

const getHotzoneEmptyMessage = (campusLocations, incidents) => {
  const locations = Array.isArray(campusLocations) ? campusLocations : [];
  const uniqueIncidents = getUniqueIncidents(incidents);
  if (!locations.length) return 'No campus locations are available for area risk analysis.';
  if (!uniqueIncidents.length) return 'No incident records are available to calculate area risk.';
  const hasMatchedIncidents = locations.some((location) => incidentsAtLocation(uniqueIncidents, location).length);
  const hasNamedIncidents = uniqueIncidents.some((incident) => (
    normalizeLocationName(incident.location_name)
    || normalizeLocationName(incident.building)
    || normalizeLocationName(incident.campus_location?.name)
  ));
  const hasGpsCoordinates = uniqueIncidents.some((incident) => {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);
    return incident.latitude !== null && incident.latitude !== undefined && incident.latitude !== ''
      && incident.longitude !== null && incident.longitude !== undefined && incident.longitude !== ''
      && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  });
  if (!hasNamedIncidents && !hasMatchedIncidents) {
    if (hasGpsCoordinates) {
      return 'Incident locations do not match a campus location. GPS-only reports cannot currently be assigned to an area.';
    }
    return 'Incident records have no location name or building to match with campus locations.';
  }
  if (!hasMatchedIncidents) {
    return 'Incident locations do not match a campus location. GPS-only reports cannot currently be assigned to an area.';
  }
  return 'The ML service returned no validated high-risk areas for these records.';
};

const getTextValue = (value) => typeof value === 'string' ? value.trim() : '';

const getNumberValue = (value) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const hasValidGpsCoordinates = (incident) => {
  const latitude = getNumberValue(incident?.latitude);
  const longitude = getNumberValue(incident?.longitude);
  return latitude !== null && latitude >= -90 && latitude <= 90
    && longitude !== null && longitude >= -180 && longitude <= 180;
};

const getValidatedCampusLocation = (incident, campusLocations) => {
  const locationId = incident?.campus_location_id ?? incident?.campus_location?.location_id;
  if (locationId === null || locationId === undefined) return null;
  return (Array.isArray(campusLocations) ? campusLocations : []).find((location) => (
    location?.location_id != null
    && String(location.location_id) === String(locationId)
    && location.is_active !== false
  )) || null;
};

const getPredictionLocation = (incident, campusLocations) => {
  const campusLocation = getValidatedCampusLocation(incident, campusLocations);
  if (campusLocation?.name) {
    const reportedText = getTextValue(incident.location_name) || getTextValue(incident.building);
    return {
      primary: `Validated campus location: ${campusLocation.name}`,
      secondary: reportedText && normalizeLocationName(reportedText) !== normalizeLocationName(campusLocation.name)
        ? `Reported text: ${reportedText}`
        : ''
    };
  }

  const reportedText = getTextValue(incident.location_name) || getTextValue(incident.building);
  if (hasValidGpsCoordinates(incident)) {
    return {
      primary: `GPS-only / unmatched location${reportedText ? `: ${reportedText}` : ''}`,
      secondary: ''
    };
  }
  return reportedText ? { primary: `Reported location: ${reportedText}`, secondary: '' } : null;
};

const verifiedHotzones = (hotzones, campusLocations, incidents) => hotzones.flatMap((zone) => {
  if (!zone || typeof zone !== 'object') return [];
  const location = campusLocations.find((candidate) => (
    candidate
    && typeof candidate === 'object'
    && candidate.location_id != null
    && zone.location_id != null
    && String(candidate.location_id) === String(zone.location_id)
  ));
  if (!location) return [];

  const locationIncidents = incidentsAtLocation(incidents, location);
  const riskScore = Number(zone.risk_score);
  if (!locationIncidents.length || !Number.isFinite(riskScore) || riskScore < 0 || riskScore > 1) return [];

  return [{
    ...zone,
    location: location.name,
    risk_score: riskScore,
    incident_count: locationIncidents.length,
    incident_types: [...new Set(locationIncidents.map((incident) => incident.type).filter(Boolean))]
  }];
});

const EMPTY_ARRAY = [];

const MLDashboard = ({ incidents = EMPTY_ARRAY, campusLocations = EMPTY_ARRAY }) => {
  const [predictions, setPredictions] = useState([]);
  const [hotzones, setHotzones] = useState([]);
  const [mlHealth, setMlHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMLData();
  }, [incidents, campusLocations]);

  const loadMLData = async () => {
    try {
      setLoading(true);
      setError('');
      const uniqueIncidents = getUniqueIncidents(incidents);
      const validLocations = Array.isArray(campusLocations) ? campusLocations : [];

      // Check ML health
      const health = await mlService.health();
      setMlHealth(health);

      // Get hotzones
      const hotzoneData = await mlService.detectHotzones(
        validLocations.map(({ location_id, name, is_active }) => ({ location_id, name, is_active })),
        uniqueIncidents.map((incident) => {
          const matchedLocation = getValidatedCampusLocation(incident, validLocations);
          return {
            incident_id: incident.incident_id ?? incident.id,
            campus_location_id: matchedLocation?.location_id,
            location_name: matchedLocation?.name ?? incident.location_name,
            building: incident.building,
            type: incident.type
          };
        })
      );
      setHotzones(verifiedHotzones(
        Array.isArray(hotzoneData?.hotzones) ? hotzoneData.hotzones : [],
        validLocations,
        uniqueIncidents
      ));

      // Predict risk for each incident
      if (uniqueIncidents.length > 0) {
        const predictionsData = await Promise.all(
          uniqueIncidents.slice(0, 5).map(async (incident, index) => {
            const prediction = await mlService.predictRisk({
              type: incident.type,
              description: incident.description || '',
              severity: incident.severity,
              location: incident.location_name || ''
            });
            return {
              ...incident,
              prediction,
              incidentKey: getIncidentId(incident) || `unidentified-${index}`
            };
          })
        );
        setPredictions(predictionsData.filter((item) => item.prediction && typeof item.prediction === 'object'));
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('ML data loading error:', error);
      // Provide a clear actionable error message and instructions
      const instructions = `ML service unavailable. To enable ML Insights:
• Start the ML service locally: cd ml-service && python -m uvicorn src.api.app:app --host 127.0.0.1 --port 5001
• Or start it in Docker: docker-compose up ml-service

The frontend will try the following endpoints: /api/ml (proxy), and http://127.0.0.1:5001.
No fake results will be shown until the real service is reachable.`;
      setError(instructions);
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
      low: '??',
      medium: '??',
      high: '??',
      critical: '??'
    };
    return emojis[risk] || '?';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h3>?? ML Dashboard</h3>
        <p style={styles.loadingText}>Loading ML predictions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h3>?? ML Dashboard</h3>
        <div style={styles.error}>
          <span>??</span>
          <pre style={{whiteSpace: 'pre-wrap', margin: 0}}>{error}</pre>
          <button onClick={loadMLData} style={styles.retryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>?? ML Dashboard</h3>
        <span style={styles.statusBadge}>
          {mlHealth?.status === 'healthy' ? '?? Online' : '?? Offline'}
        </span>
      </div>

      {/* Hotzones */}
      <div style={styles.section}>
        <h4>?? High-Risk Areas</h4>
        {hotzones.length === 0 ? (
          <p style={styles.emptyText}>{getHotzoneEmptyMessage(campusLocations, incidents)}</p>
        ) : (
          <div style={styles.hotzoneGrid}>
            {hotzones.map((zone) => (
              <div key={zone.location_id} style={styles.hotzoneCard}>
                <div style={styles.hotzoneHeader}>
                  <span style={styles.hotzoneName}>{zone.location}</span>
                  <span style={{...styles.riskBadge, backgroundColor: getRiskColor(zone.risk_score >= 0.7 ? 'high' : 'medium')}}>
                    {Math.round(zone.risk_score * 100)}%
                  </span>
                </div>
                <div style={styles.hotzoneDetails}>
                  <span>?? {zone.incident_count} incidents</span>
                  <span>?? {zone.incident_types?.join(', ') || 'Various'}</span>
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
        <h4>?? Risk Predictions</h4>
        {predictions.length === 0 ? (
          <p style={styles.emptyText}>No predictions available</p>
        ) : (
          predictions.map((item, index) => {
            if (!item.prediction || typeof item.prediction !== 'object') return null;
            const incidentId = getIncidentId(item);
            const riskLevel = getTextValue(item.prediction.risk_level).toLowerCase();
            const validRiskLevels = ['low', 'medium', 'high', 'critical'];
            const hasRiskLevel = validRiskLevels.includes(riskLevel);
            const confidence = getNumberValue(item.prediction.confidence);
            const responseTime = getNumberValue(item.prediction.estimated_response_time);
            const hasValidConfidence = confidence !== null && confidence >= 0 && confidence <= 1;
            const hasValidResponseTime = responseTime !== null && responseTime >= 0;
            const incidentType = getTextValue(item.type);
            const description = getTextValue(item.description);
            const location = getPredictionLocation(item, campusLocations);
            const timestamp = getTextValue(item.created_at) || getTextValue(item.location_timestamp);
            const parsedTimestamp = timestamp ? Date.parse(timestamp) : Number.NaN;
            const suggestedAction = getTextValue(item.prediction.suggested_action);

            return (
              <div key={item.incidentKey || incidentId || `prediction-${index}`} style={styles.predictionCard}>
                <div style={styles.predictionHeader}>
                  <span style={styles.predictionType}>{incidentType ? incidentType.toUpperCase() : 'Incident'}</span>
                  <div style={styles.predictionBadges}>
                    <span style={{...styles.riskBadge, backgroundColor: getRiskColor(hasRiskLevel ? riskLevel : '')}}>
                      {hasRiskLevel
                        ? `${getRiskEmoji(riskLevel)} ${riskLevel.charAt(0).toUpperCase()}${riskLevel.slice(1)}`
                        : 'Risk unavailable'}
                    </span>
                    {(item.is_sos === true || item.is_sos === 1 || item.is_sos === 'true') && (
                      <span style={styles.sosBadge}>?? SOS</span>
                    )}
                  </div>
                </div>
                <div style={styles.predictionIdentity}>
                  {incidentId && <span>Incident: {incidentId}</span>}
                  {location && <span>{location.primary}</span>}
                  {location?.secondary && <span>{location.secondary}</span>}
                  {Number.isFinite(parsedTimestamp) && (
                    <time dateTime={timestamp}>Reported: {new Date(parsedTimestamp).toLocaleString()}</time>
                  )}
                </div>
                <div style={styles.predictionBody}>
                  <p>{description || 'No description provided.'}</p>
                  {(hasValidConfidence || hasValidResponseTime) && (
                    <div style={styles.predictionDetails}>
                      {hasValidConfidence && (
                        <span>?? Confidence: {Math.round(confidence * 100)}%</span>
                      )}
                      {hasValidResponseTime && (
                        <span>?? Response: {responseTime} min</span>
                      )}
                    </div>
                  )}
                  {suggestedAction && (
                    <div style={styles.actionBox}>
                      <span>?? {suggestedAction}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
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
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '10px'
  },
  predictionBadges: {
    display: 'grid',
    justifyItems: 'start',
    rowGap: '8px'
  },
  predictionIdentity: {
    display: 'grid',
    rowGap: '6px',
    marginBottom: '8px',
    color: '#666',
    fontSize: '12px',
    overflowWrap: 'anywhere'
  },
  sosBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    color: '#b42318',
    backgroundColor: '#fef3f2',
    fontSize: '11px',
    fontWeight: 'bold'
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
    display: 'grid',
    rowGap: '4px',
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
