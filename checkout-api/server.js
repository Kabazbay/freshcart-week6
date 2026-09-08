const express = require('express');
const { Pool } = require('pg');

const app = express();

// Force immediate exit on startup
process.exit(1);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
