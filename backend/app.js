

// FIX ADDED FOR Cannot GET / ERROR
const path = require('path');
app.get('*', (req, res) => {
  // CHANGE 'dist' to 'build' if you are using Create React App
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
