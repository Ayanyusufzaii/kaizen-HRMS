require('dotenv').config();
const express = require('express');

const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Ensure 'uploads' folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log('✅ uploads/ folder created');
}

// Serve static files (e.g., uploaded profile pictures)
app.use('/uploads', express.static(uploadDir));

// MySQL Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,        
  user: process.env.DB_USER,       
  password: process.env.DB_PASS,   
  database: process.env.DB_NAME,   
  port: 3306,
  ssl: {
    rejectUnauthorized: true 
  }
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database.');
});

// ✅ Redirect API routes to api.js
const apiRoutes = require('./api')(db); 
app.use('/api', apiRoutes);


// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
