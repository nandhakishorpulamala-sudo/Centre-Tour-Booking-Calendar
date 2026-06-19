import React, { useEffect, useState } from 'react'
import BookingDetails from './BookingDetails'
import Admin from './Admin'

export default function App() {
  const [bookings, setBookings] = useState([])
  const [form, setForm] = useState({ name: '', email: '', phone: '', preferred_datetime: '' })
  const [selectedId, setSelectedId] = useState(null)

  async function loadBookings() {
    const res = await fetch('/api/bookings')
    const data = await res.json()
    setBookings(data)
  }

  useEffect(() => { loadBookings() }, [])

  async function submit(e) {
    e.preventDefault()
    const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) {
      setForm({ name: '', email: '', phone: '', preferred_datetime: '' })
      const data = await res.json()
      setBookings(b => [data, ...b])
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Centre Tour Booking</h1>
        <div>
          <button onClick={() => setShowAdmin(s => !s)} style={{ marginRight: 8 }}>{showAdmin ? 'Close Admin' : 'Open Admin'}</button>
        </div>
      </div>
      {showAdmin ? <Admin onClose={() => setShowAdmin(false)} /> : (
      <div style={{ display: 'flex', gap: 40 }}>
        <div style={{ flex: 1 }}>
          <form onSubmit={submit} style={{ marginBottom: 20 }}>
            <div>
              <label>Name</label><br />
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label>Email</label><br />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label>Phone</label><br />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label>Preferred Date/Time</label><br />
              <input type="datetime-local" value={form.preferred_datetime} onChange={e => setForm({ ...form, preferred_datetime: e.target.value })} />
            </div>
            <button type="submit" style={{ marginTop: 10 }}>Request Tour</button>
          </form>

          <h2>Recent Requests</h2>
          <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
            {bookings.map(b => (
              <li key={b.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => setSelectedId(b.id)}>
                <strong>{b.name}</strong> — {b.status} — {b.preferred_datetime ? new Date(b.preferred_datetime).toLocaleString() : 'no time'}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ width: 420 }}>
          {selectedId ? <BookingDetails id={selectedId} onClose={() => setSelectedId(null)} onUpdated={loadBookings} /> : <div style={{ color: '#666' }}>Select a booking to view details</div>}
        </div>
      </div>
      )}
    </div>
  )
}
