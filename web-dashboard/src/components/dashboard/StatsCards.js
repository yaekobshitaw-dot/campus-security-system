import { Card, CardContent, Grid, Typography } from '@mui/material';

const StatCard = ({ label, value, trend, color = '#1976d2' }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, color }}>
          {value ?? 0}
        </Typography>
        {trend && (
          <Typography variant="caption" color="success.main">
            {trend}
          </Typography>
        )}
      </CardContent>
    </Card>
  </Grid>
);

export const StatsCards = ({ stats }) => {
  const statsMap = stats || {};

  return (
    <>
      <StatCard label="Total Incidents" value={statsMap.total ?? 0} trend="Live" color="#d32f2f" />
      <StatCard label="Open Incidents" value={statsMap.open ?? 0} trend="Needs response" color="#ed6c02" />
      <StatCard label="Resolved" value={statsMap.resolved ?? 0} trend="Recovered" color="#2e7d32" />
      <StatCard label="Critical" value={statsMap.critical ?? 0} trend="Priority" color="#9c27b0" />
    </>
  );
};

export default StatsCards;
