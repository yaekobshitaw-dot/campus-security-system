const express = require('express');
const app = express();
const PORT = 5000;

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', message: 'Server is running!' });
});

app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
