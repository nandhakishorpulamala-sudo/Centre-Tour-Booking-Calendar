function hoursBetween(a, b) {
  return Math.abs((new Date(a) - new Date(b)) / (1000 * 60 * 60))
}

function applyWorkflow(booking) {
  if (!booking) return { suggestion: 'no data', recommendedStatus: null, priority: 'low' }

  const now = new Date()
  const pref = booking.preferred_datetime ? new Date(booking.preferred_datetime) : null
  let recommendedStatus = null
  let suggestion = 'No suggestion'
  let priority = 'low'

  if (booking.status === 'enquiry') {
    if (!pref) {
      suggestion = 'Request preferred date/time from parent';
      recommendedStatus = 'enquiry'
      priority = 'high'
    } else {
      const hrs = hoursBetween(pref, now)
      if (pref > now && hrs <= 48) {
        suggestion = 'Schedule and confirm the tour within 48 hours';
        recommendedStatus = 'scheduled'
        priority = 'high'
      } else {
        suggestion = 'Schedule the tour and follow up';
        recommendedStatus = 'scheduled'
        priority = 'medium'
      }
    }
  } else if (booking.status === 'scheduled') {
    if (pref && pref > now && hoursBetween(pref, now) <= 24) {
      suggestion = 'Send confirmation and reminder';
      recommendedStatus = 'scheduled'
      priority = 'high'
    } else {
      suggestion = 'Ensure time is confirmed with guardian';
      recommendedStatus = 'scheduled'
      priority = 'medium'
    }
  } else if (booking.status === 'follow-up') {
    suggestion = 'Call/WhatsApp the guardian to convert to scheduled tour';
    recommendedStatus = 'follow-up'
    priority = 'high'
  } else if (booking.status === 'confirmed') {
    suggestion = 'Prepare admission conversion steps and documents';
    recommendedStatus = 'confirmed'
    priority = 'low'
  } else {
    suggestion = 'No specific workflow recommendation'
    recommendedStatus = booking.status
  }

  return { suggestion, recommendedStatus, priority }
}

module.exports = { applyWorkflow }
