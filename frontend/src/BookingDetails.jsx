import React, { useEffect, useState } from 'react'

export default function BookingDetails({ id, onClose, onUpdated }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/bookings/${id}`)
    if (res.ok) {
      const json = await res.json()
      setData(json)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function doAction(action) {
    await fetch(`/api/bookings/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes })
    })
    await load()
    if (onUpdated) onUpdated()
  }

  if (loading) return <div>Loading…</div>
  if (!data) return <div>Not found</div>

  const { booking, history } = data

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{booking.name}</h3>
        <button onClick={onClose}>Close</button>
      </div>
      <div style={{ color: '#555', marginBottom: 8 }}>{booking.email} • {booking.phone}</div>
      <div style={{ marginBottom: 8 }}>Preferred: {booking.preferred_datetime ? new Date(booking.preferred_datetime).toLocaleString() : '—'}</div>
      <div style={{ marginBottom: 12 }}>Status: <strong>{booking.status}</strong></div>

      <div style={{ marginBottom: 8 }}>
        <textarea placeholder="notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', minHeight: 60 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => doAction('confirm')}>Confirm</button>
        <button onClick={() => doAction('schedule')}>Schedule</button>
        <button onClick={() => doAction('follow-up')}>Follow-up</button>
      </div>

      <h4 style={{ marginTop: 0 }}>History</h4>
      <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
        {history.length === 0 && <li style={{ color: '#666' }}>No actions yet</li>}
        {history.map(h => (
          <li key={h.id} style={{ padding: '6px 0', borderBottom: '1px solid #f2f2f2' }}>
            <div style={{ fontSize: 13 }}><strong>{h.action}</strong> {h.performed_by_name ? `by ${h.performed_by_name}` : ''}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{h.notes}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{new Date(h.created_at).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
