const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const serverless = require('serverless-http');

// Define connection state to prevent reconnects in serverless environments
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/deskflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
};

// Import Routes and Models
const ticketRoutes = require('../../backend/routes/ticketRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Lazy database connection inside the request cycle for serverless
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Mount routes at /tickets AND /.netlify/functions/api/tickets (to support both routing schemes)
app.use('/tickets', ticketRoutes);
app.use('/.netlify/functions/api/tickets', ticketRoutes);

// Root path handler
app.get('/', (req, res) => {
  res.send('DeskFlow Support Ticket System API is running on Netlify Functions...');
});
app.get('/.netlify/functions/api', (req, res) => {
  res.send('DeskFlow Support Ticket System API is running on Netlify Functions...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server Error occurred' });
});

module.exports.handler = serverless(app);
