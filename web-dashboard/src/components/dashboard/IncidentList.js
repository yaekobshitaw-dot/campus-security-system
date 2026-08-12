import { Box, Chip, Divider, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';

export const IncidentList = ({ incidents = [], onIncidentClick }) => {
  if (!incidents.length) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary">No incidents found</Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {incidents.map((incident, index) => (
        <Box key={incident.incident_id || index}>
          <ListItem disablePadding>
            <ListItemButton onClick={() => onIncidentClick?.(incident)}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {incident.type || 'Incident'}
                    </Typography>
                    <Chip
                      size="small"
                      label={incident.severity || 'medium'}
                      color={incident.severity === 'critical' ? 'error' : incident.severity === 'high' ? 'warning' : 'success'}
                    />
                  </Box>
                }
                secondary={
                  <>
                    <Typography variant="caption" display="block">
                      {incident.location_name || incident.location || 'Campus'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {incident.status || 'open'} · {incident.created_at || 'Recently'}
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>
          {index < incidents.length - 1 && <Divider />}
        </Box>
      ))}
    </List>
  );
};

export default IncidentList;
