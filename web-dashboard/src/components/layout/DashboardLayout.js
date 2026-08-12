import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';

export const DashboardLayout = ({ children }) => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Campus Security Dashboard
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
};

export default DashboardLayout;
