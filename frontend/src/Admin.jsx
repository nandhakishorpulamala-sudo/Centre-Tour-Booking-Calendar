import React, { useEffect, useState } from 'react'

export default function Admin({ onClose }) {
  const [filters, setFilters] = useState({ status: '', owner_id: '', source: '' })
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(new Set())

  async function load() {
    const qs = new URLSearchParams(filters).toString()
    const res = await fetch('/api/admin/bookings' + (qs ? `?${qs}` : ''))
    const data = await res.json()
    setRows(data)
  }

  useEffect(() => { load() }, [])

  function toggle(id) {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }

  async function assignOwner(id, owner_id) {
    await fetch(`/api/admin/bookings/${id}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner_id }) })
    load()
  }

  async function bulkAction(action) {
    const ids = Array.from(selected)
    if (ids.length === 0) return alert('select rows')
    await fetch('/api/admin/bookings/bulk-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action }) })
    setSelected(new Set())
    load()
  }

  function exportCSV() {
    window.location.href = '/api/admin/bookings/export.csv'
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input placeholder="status" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} />
        <input placeholder="owner_id" value={filters.owner_id} onChange={e => setFilters({ ...filters, owner_id: e.target.value })} />
        <input placeholder="source" value={filters.source} onChange={e => setFilters({ ...filters, source: e.target.value })} />
        <button onClick={load}>Filter</button>
        <button onClick={exportCSV}>Export CSV</button>
        <button onClick={onClose}>Close</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <button onClick={() => bulkAction('confirmed')}>Bulk Confirm</button>
        <button onClick={() => bulkAction('scheduled')}>Bulk Schedule</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th></th><th>Name</th><th>Email</th><th>Phone</th><th>Preferred</th><th>Status</th><th>Owner</th><th>Assign</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
              <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td>{r.name}</td>
              <td>{r.email}</td>
              <td>{r.phone}</td>
              <td>{r.preferred_datetime ? new Date(r.preferred_datetime).toLocaleString() : ''}</td>
              <td>{r.status}</td>
              <td>{r.owner_name || ''}</td>
              <td><button onClick={() => { const oid = prompt('owner id'); if (oid) assignOwner(r.id, oid) }}>Assign</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
