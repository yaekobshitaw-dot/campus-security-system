const dotenv = require('dotenv');
dotenv.config();

const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campus_security'
});

console.log('📊 Testing MySQL connection...');
console.log(`📍 Host: ${connection.config.host}:${connection.config.port}`);
console.log(`🧾 User: ${connection.config.user}`);
console.log(`🗄️  Database: ${connection.config.database}`);

connection.connect((err) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Is MySQL running on the configured host/port?');
    console.log('2. Is the password in backend/.env correct?');
    console.log('3. Does the configured database exist?');
    process.exit(1);
  }

  console.log('✅ MySQL connection successful!');
  connection.query('SELECT VERSION() as version, DATABASE() as db', (err, results) => {
    if (err) throw err;
    console.log(`📊 MySQL Version: ${results[0].version}`);
    console.log(`🗄️  Database: ${results[0].db}`);
    connection.end();
    console.log('\n🎉 Everything is working!');
    process.exit(0);
  });
});