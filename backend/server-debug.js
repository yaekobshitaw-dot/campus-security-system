process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

console.log('Starting server...');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

console.log('Loading dotenv...');
dotenv.config();

console.log('Creating app...');
const app = express();
const PORT = process.env.PORT || 5000;

console.log('Setting up middleware...');
app.use(cors());
app.use(express.json());

console.log('Setting up health check...');
app.get('/health', (req, res) => {
    console.log('Health check called');
    res.json({ status: 'healthy', message: 'Server is running!' });
});

console.log('Loading auth routes...');
try {
    const authRoutes = require('./src/routes/authRoutes');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Auth routes error:', error.message);
    console.error(error.stack);
}

console.log('Starting server...');
app.listen(PORT, () => {
    console.log('🚀 Server running on http://localhost:' + PORT);
});
