import { Box, Grid, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const COLORS = ['#d32f2f', '#ff9800', '#2e7d32', '#1976d2', '#9c27b0'];

export const AnalyticsCharts = ({ stats = {} }) => {
  const incidentData = [
    { name: 'Critical', value: stats.critical || 0 },
    { name: 'High', value: stats.high || 0 },
    { name: 'Medium', value: stats.medium || 0 },
    { name: 'Low', value: stats.low || 0 }
  ];

  const trendData = [
    { date: 'Mon', incidents: stats.mon || 2 },
    { date: 'Tue', incidents: stats.tue || 4 },
    { date: 'Wed', incidents: stats.wed || 1 },
    { date: 'Thu', incidents: stats.thu || 5 },
    { date: 'Fri', incidents: stats.fri || 3 }
  ];

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Box sx={{ height: 260 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Severity Mix</Typography>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={incidentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} fill="#8884d8" label>
                {incidentData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </Grid>

      <Grid item xs={12} md={4}>
        <Box sx={{ height: 260 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Incident Volume</Typography>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="incidents" fill="#1976d2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Grid>

      <Grid item xs={12} md={4}>
        <Box sx={{ height: 260 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Response Trend</Typography>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="incidents" stroke="#2e7d32" strokeWidth={3} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Grid>
    </Grid>
  );
};

export default AnalyticsCharts;
