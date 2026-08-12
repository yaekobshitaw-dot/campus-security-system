const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { sequelize } = require('./src/models');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/incidents', require('./src/routes/incidentRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    await sequelize.sync();
    console.log('✅ Database synced');
    app.listen(PORT, () => {
      console.log('🚀 Server running on http://localhost:' + PORT);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
  }
}

startServer();
