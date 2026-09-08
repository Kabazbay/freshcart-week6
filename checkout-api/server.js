// This will crash Node on startup
const missing = require('nonexistent-broken-package');

const express = require('express');
const { Pool } = require('pg');

const app = express();

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
