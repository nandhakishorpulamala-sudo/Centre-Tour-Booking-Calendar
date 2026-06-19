const express = require('express');
const cors = require('cors');
require('dotenv').config();

const bookingsRouter = require('./routes/bookings');
const adminRouter = require('./routes/admin');
const scheduledJob = require('./scheduledJob');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Centre Tour Backend listening on ${PORT}`);
  // start scheduled background tasks (reminders)
  try { scheduledJob.start(); } catch (err) { console.error('failed to start scheduled jobs', err); }
});
