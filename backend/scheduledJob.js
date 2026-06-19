const { pool } = require('./db');
const notifications = require('./notifications');

const LOOKAHEAD_HOURS = parseInt(process.env.REMINDER_LOOKAHEAD_HOURS || '24', 10);
const INTERVAL_MINUTES = parseInt(process.env.REMINDER_INTERVAL_MINUTES || '15', 10);

async function sendReminders() {
  try {
    const now = new Date();
    const until = new Date(now.getTime() + LOOKAHEAD_HOURS * 3600 * 1000);
    const q = `SELECT * FROM bookings WHERE status = 'scheduled' AND reminder_sent = false AND preferred_datetime IS NOT NULL AND preferred_datetime BETWEEN $1 AND $2`;
    const res = await pool.query(q, [now.toISOString(), until.toISOString()]);
    for (const b of res.rows) {
      try {
        console.log('Sending reminder for booking', b.id)
        await notifications.notifyForAction('schedule', b)
        await pool.query(`UPDATE bookings SET reminder_sent = true, last_reminder_at = now() WHERE id=$1`, [b.id]);
        await pool.query(`INSERT INTO workflow_history (booking_id, action, notes) VALUES ($1,$2,$3)`, [b.id, 'reminder-sent', 'automated reminder']);
      } catch (err) {
        console.error('failed to send reminder for', b.id, err)
      }
    }
  } catch (err) {
    console.error('sendReminders error', err)
  }
}

function start() {
  console.log('Starting scheduled reminders every', INTERVAL_MINUTES, 'minutes; lookahead', LOOKAHEAD_HOURS, 'hours')
  // run immediately then on interval
  sendReminders();
  setInterval(sendReminders, INTERVAL_MINUTES * 60 * 1000);
}

module.exports = { start };
