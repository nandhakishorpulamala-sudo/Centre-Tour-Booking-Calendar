const express = require('express');
const router = express.Router();
const { pool, init } = require('../db');
const { applyWorkflow } = require('../workflow');
const notifications = require('../notifications');
const ai = require('../ai');

init().catch(err => console.error('DB init error', err));

function isValidEmail(email) {
  if (!email) return true;
  return /\S+@\S+\.\S+/.test(email);
}

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, preferred_datetime, source, owner_id } = req.body;
    if (!name || name.trim().length === 0) return res.status(400).json({ error: 'name is required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid email' });

    const preferred = preferred_datetime ? new Date(preferred_datetime) : null;

    const result = await pool.query(
      `INSERT INTO bookings (name, email, phone, preferred_datetime, source, owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), email || null, phone || null, preferred, source || 'web', owner_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create booking' });
  }
});

// GET /api/bookings?status=&owner_id=&source=&limit=
router.get('/', async (req, res) => {
  try {
    const { status, owner_id, source, limit } = req.query;
    const clauses = [];
    const params = [];
    let idx = 1;
    if (status) { clauses.push(`status = $${idx++}`); params.push(status); }
    if (owner_id) { clauses.push(`owner_id = $${idx++}`); params.push(owner_id); }
    if (source) { clauses.push(`source = $${idx++}`); params.push(source); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const lim = limit ? `LIMIT ${parseInt(limit, 10)}` : '';
    const q = `SELECT * FROM bookings ${where} ORDER BY created_at DESC ${lim}`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to list bookings' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const b = await pool.query(`SELECT * FROM bookings WHERE id=$1`, [id]);
    if (b.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const history = await pool.query(`SELECT wh.*, u.name as performed_by_name FROM workflow_history wh LEFT JOIN users u ON u.id = wh.performed_by WHERE wh.booking_id=$1 ORDER BY wh.created_at DESC`, [id]);
    const suggestion = applyWorkflow(b.rows[0]);
    const aiSummary = await ai.summarizeBooking(b.rows[0], history.rows).catch(e => { console.error('ai summary error', e); return null });
    res.json({ booking: b.rows[0], history: history.rows, suggestion, aiSummary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch booking' });
  }
});

// Action endpoint: records workflow action and updates status/owner
router.post('/:id/action', async (req, res) => {
  try {
    const id = req.params.id;
    const { action, performed_by, notes, owner_id } = req.body; // performed_by = user id
    if (!action) return res.status(400).json({ error: 'action is required' });

    // map action to status
    let status = null;
    if (action === 'confirm') status = 'confirmed';
    else if (action === 'schedule') status = 'scheduled';
    else if (action === 'follow-up') status = 'follow-up';
    else status = action;

    await pool.query('BEGIN');
    const updateRes = await pool.query(`UPDATE bookings SET status=$1, owner_id=COALESCE($2, owner_id) WHERE id=$3 RETURNING *`, [status, owner_id || performed_by || null, id]);
    await pool.query(`INSERT INTO workflow_history (booking_id, action, performed_by, notes) VALUES ($1,$2,$3,$4)`, [id, action, performed_by || null, notes || null]);
    await pool.query('COMMIT');

    const booking = updateRes.rows[0];
    const history = await pool.query(`SELECT wh.*, u.name as performed_by_name FROM workflow_history wh LEFT JOIN users u ON u.id = wh.performed_by WHERE wh.booking_id=$1 ORDER BY wh.created_at DESC`, [id]);
    const suggestion = applyWorkflow(booking);
    const aiSummary = await ai.summarizeBooking(booking, history.rows).catch(e => { console.error('ai summary error', e); return null });

    // Send notifications for important actions (stubbed)
    if (['confirm', 'schedule'].includes(action)) {
      notifications.notifyForAction(action, booking).then(r => console.log('notification result', r)).catch(e => console.error('notify error', e));
    }

    res.json({ booking, history: history.rows, suggestion, aiSummary });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'failed to perform action' });
  }
});

module.exports = router;
