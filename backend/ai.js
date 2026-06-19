const OPENAI_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(prompt) {
  if (!OPENAI_KEY) throw new Error('no api key');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2
    })
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const j = await res.json();
  return j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
}

function simpleSummary(booking, history) {
  const lines = [];
  lines.push(`${booking.name} (${booking.email || 'no email'}, ${booking.phone || 'no phone'})`);
  lines.push(`Status: ${booking.status}`);
  if (booking.preferred_datetime) lines.push(`Preferred: ${new Date(booking.preferred_datetime).toLocaleString()}`);
  if (history && history.length) {
    lines.push('Recent actions:');
    history.slice(0,3).forEach(h => lines.push(`- ${h.action}${h.performed_by_name ? ' by ' + h.performed_by_name : ''}${h.notes ? ' — ' + h.notes : ''}`));
  }
  const short = lines.join(' | ');
  const suggested_message = `Hi ${booking.name.split(' ')[0] || ''}, we have your tour ${booking.status}. We'll confirm the timing soon.`;
  return { short_summary: short, suggested_message };
}

async function summarizeBooking(booking, history) {
  try {
    if (OPENAI_KEY) {
      const prompt = `Summarize this booking in two short sentences and provide a suggested confirmation message.

Booking:\n${JSON.stringify(booking, null, 2)}\n\nHistory:\n${JSON.stringify(history.slice(0,5), null, 2)}\n\nReturn JSON with keys: short_summary, suggested_message.`;
      const text = await callOpenAI(prompt);
      // try to parse JSON from response
      const jsonStart = text.indexOf('{');
      const json = jsonStart >= 0 ? JSON.parse(text.slice(jsonStart)) : JSON.parse(text);
      return json;
    }
  } catch (err) {
    console.error('AI summarize error', err);
  }
  return simpleSummary(booking, history);
}

module.exports = { summarizeBooking };
