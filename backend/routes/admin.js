const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/admin/bookings?status=&owner_id=&source=
router.get('/bookings', async (req, res) => {
  try {
    const { status, owner_id, source } = req.query;
    const clauses = [];
    const params = [];
    let idx = 1;
    if (status) { clauses.push(`status = $${idx++}`); params.push(status); }
    if (owner_id) { clauses.push(`owner_id = $${idx++}`); params.push(owner_id); }
    if (source) { clauses.push(`source = $${idx++}`); params.push(source); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const q = `SELECT b.*, u.name as owner_name FROM bookings b LEFT JOIN users u ON u.id = b.owner_id ${where} ORDER BY created_at DESC`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to list bookings' });
  }
});

// POST /api/admin/bookings/:id/assign { owner_id }
router.post('/bookings/:id/assign', async (req, res) => {
  try {
    const { owner_id } = req.body;
    const id = req.params.id;
    const result = await pool.query(`UPDATE bookings SET owner_id=$1 WHERE id=$2 RETURNING *`, [owner_id || null, id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to assign owner' });
  }
});

// POST /api/admin/bookings/bulk-action { ids: [1,2], action: 'confirm' }
router.post('/bookings/bulk-action', async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
    const q = `UPDATE bookings SET status=$1 WHERE id = ANY($2::int[]) RETURNING *`;
    const result = await pool.query(q, [action, ids]);
    res.json({ updated: result.rows.length, rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed bulk update' });
  }
});

// GET /api/admin/bookings/export.csv
router.get('/bookings/export.csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT b.id, b.name, b.email, b.phone, b.preferred_datetime, b.status, u.name as owner_name, b.created_at FROM bookings b LEFT JOIN users u ON u.id = b.owner_id ORDER BY b.created_at DESC`);
    const rows = result.rows;
    const header = ['id','name','email','phone','preferred_datetime','status','owner_name','created_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const vals = header.map(h => {
        const v = r[h] === null || r[h] === undefined ? '' : String(r[h]).replace(/"/g, '""');
        return `"${v}"`;
      });
      lines.push(vals.join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to export' });
  }
});

module.exports = router;
