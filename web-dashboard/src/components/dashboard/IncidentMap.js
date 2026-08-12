import { Box, Typography } from '@mui/material';

export const IncidentMap = ({ incidents = [], height = 400, center = [9.0227, 38.7468], zoom = 15 }) => {
  const points = incidents.slice(0, 12);

  return (
    <Box
      sx={{
        height,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid #d6dde8',
        bgcolor: '#eef9ff',
        position: 'relative'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(45deg, transparent 49%, rgba(25,118,210,.12) 50%, transparent 51%), linear-gradient(-45deg, transparent 49%, rgba(25,118,210,.12) 50%, transparent 51%)',
          backgroundSize: '48px 48px',
          opacity: 0.9
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: '#d32f2f',
          border: '2px solid white',
          transform: 'translate(-50%, -50%)'
        }}
      />
      {points.map((incident, index) => (
        <Box
          key={incident.incident_id || index}
          sx={{
            position: 'absolute',
            left: `${18 + ((index * 13) % 70)}%`,
            top: `${10 + ((index * 17) % 70)}%`,
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: incident.severity === 'critical' ? '#d32f2f' : incident.severity === 'high' ? '#ff9800' : '#2e7d32',
            border: '2px solid white',
            boxShadow: 2
          }}
          title={incident.type || 'Incident'}
        />
      ))}
      <Box sx={{ position: 'absolute', left: 12, top: 12 }}>
        <Typography variant="caption" color="text.secondary">
          Center: {center[0]}, {center[1]} · Zoom: {zoom}
        </Typography>
      </Box>
    </Box>
  );
};

export default IncidentMap;
