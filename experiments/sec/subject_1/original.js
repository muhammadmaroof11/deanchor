// Subject: User Authentication and Profile Lookup Endpoint
// Legacy Vulnerabilities: SQL concatenation (SQLi), unsigned JWT decoding, hardcoded fallback secrets

const express = require('express');
const sqlite3 = require('sqlite3');
const jwt = require('jsonwebtoken');

const app = express();
const db = new sqlite3.Database(':memory:');
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "SUPER_INSECURE_HARDCODED_DEFAULT_SECRET_123!";

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // VULNERABILITY 1: Direct SQL Injection concatenation
  const query = "SELECT id, username, role FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  
  db.get(query, (err, row) => {
    if (err) return res.status(500).send("Database error");
    if (!row) return res.status(401).send("Invalid credentials");

    // VULNERABILITY 2: Generating token with none algorithm or weak expiration
    const token = jwt.sign({ id: row.id, username: row.username, role: row.role }, JWT_SECRET);
    res.json({ token, role: row.role });
  });
});

app.get('/api/profile', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).send("No token");

  const token = authHeader.split(' ')[1];
  
  // VULNERABILITY 3: Insecure decoding without signature verification
  const decoded = jwt.decode(token);
  
  // VULNERABILITY 4: SQL Injection via decoded token parameter
  const profileQuery = "SELECT * FROM profiles WHERE user_id = " + decoded.id;
  db.get(profileQuery, (err, profile) => {
    if (err) return res.status(500).send("Error");
    res.json(profile);
  });
});

module.exports = app;
