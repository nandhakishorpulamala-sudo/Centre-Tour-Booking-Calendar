import datetime

def generate_suggestions(enquiry, recent_activities=[]):
    """
    Evaluates an enquiry and its recent activities to produce smart suggestions,
    counsellor priorities, and automated messaging templates.
    """
    status = enquiry.get('status', 'Enquiry')
    parent_name = enquiry.get('parent_name', 'Parent')
    child_name = enquiry.get('child_name', 'Child')
    child_age = enquiry.get('child_age', 3)
    source = enquiry.get('source', 'Parent Enquiry')
    notes = enquiry.get('notes', '') or ''
    
    priority = "Medium"
    recommendation = ""
    whatsapp_template = ""
    email_subject = ""
    email_body = ""
    
    # 1. Evaluate Status-based Rules
    if status == 'Enquiry':
        priority = "Medium"
        recommendation = "Call parent to schedule a Centre Tour. Mention our flexible morning schedules."
        if "playground" in notes.lower() or "outdoor" in notes.lower():
            recommendation = "Call parent to schedule a Centre Tour. Highlight our brand-new outdoor playground facilities."
            
        whatsapp_template = f"Hi {parent_name}! Thank you for your enquiry regarding {child_name} at Centre Tour Booking. We would love to invite you for a personal tour of our classrooms. Let us know a convenient time this week!"
        email_subject = f"Welcome to Centre Tour Booking - Enquiry for {child_name}"
        email_body = f"Dear {parent_name},\n\nThank you for reaching out to us. We have received your inquiry for {child_name} (Age {child_age}).\n\nOur centre director would love to show you around and discuss our early learning curriculum. Please let us know your preferred date and time for a tour.\n\nWarm regards,\nCentre Admissions Team"
        
    elif status == 'Tour':
        priority = "High"
        recommendation = "Prepare tour guidebook. Ensure classrooms are set up for visitor walkthrough."
        whatsapp_template = f"Hello {parent_name}, this is a reminder for your scheduled centre tour for {child_name} tomorrow. We are excited to meet you! If you need directions, let us know."
        email_subject = f"Reminder: Scheduled Centre Tour for {child_name}"
        email_body = f"Dear {parent_name},\n\nWe are looking forward to welcoming you and {child_name} for your scheduled tour tomorrow.\n\nOur address is 123 Learning Lane. Please ask for Sarah or Michael at the front desk.\n\nBest regards,\nCentre Admissions Team"
        
    elif status == 'Demo':
        priority = "High"
        recommendation = "Follow up after the demo class. Ask if the child enjoyed the trial session activities."
        whatsapp_template = f"Hi {parent_name}! We hope {child_name} had a wonderful time in our sandbox trial session today. We would love to hear your feedback!"
        email_subject = f"How did {child_name} enjoy the trial class?"
        email_body = f"Dear {parent_name},\n\nIt was a pleasure hosting {child_name} for our demo trial session today.\n\nWe would love to know your thoughts and answer any questions you might have about our curriculum or fees.\n\nWarm regards,\nCentre Admissions Team"
        
    elif status == 'Follow-up':
        priority = "Medium"
        recommendation = "Check-in on payment plan options or schedule a call to resolve enrollment doubts."
        whatsapp_template = f"Hi {parent_name}, just checking in to see if you have any questions regarding the enrollment forms or pricing schedules we sent over. We are here to help!"
        email_subject = f"Enrollment next steps for {child_name}"
        email_body = f"Dear {parent_name},\n\nWe wanted to follow up and see if you had a chance to review the enrolment forms.\n\nPlease let us know if you need any assistance or have questions about transport, meals, or daycare hours.\n\nWarm regards,\nCentre Admissions Team"
        
    elif status == 'Referral':
        priority = "Medium"
        recommendation = "Apply family referral discount code and confirm referee validation."
        whatsapp_template = f"Hi {parent_name}! Good news: your referral code from family discount has been processed. We've applied it to your account draft."
        email_subject = f"Referral Discount Applied for {child_name}'s Enrolment"
        email_body = f"Dear {parent_name},\n\nWe are pleased to inform you that your family referral discount has been validated and applied to the tuition fee schedule.\n\nLet us know when you are ready to complete the registration.\n\nBest regards,\nCentre Admissions Team"

    elif status == 'Seat Availability':
        priority = "High"
        recommendation = "URGENT: Classroom capacity is almost reached. Notify parent that only 2 spots remain in this age bracket."
        whatsapp_template = f"URGENT: Hi {parent_name}! We have limited availability remaining for {child_age}-year-olds. Please secure {child_name}'s seat by today to avoid waitlisting."
        email_subject = f"Secure {child_name}'s seat - Limited availability"
        email_body = f"Dear {parent_name},\n\nWe wanted to alert you that our nursery class for child age {child_age} is reaching full capacity.\n\nTo ensure {child_name} has a guaranteed seat, we recommend completing the deposit payment. Let us know if we should hold the spot.\n\nWarm regards,\nCentre Admissions Team"
        
    elif status == 'Confirmed':
        priority = "Low"
        recommendation = "Onboarding completed. Archive or transition lead to active student management system."
        whatsapp_template = f"Welcome aboard, {parent_name}! We are thrilled to have {child_name} join our school family. Enrolment is fully confirmed!"
        email_subject = f"Enrolment Confirmed! Welcome {child_name} to Centre"
        email_body = f"Dear {parent_name},\n\nCongratulations! {child_name}'s enrollment is officially confirmed. We are excited for a great academic journey together.\n\nWe will send the welcome pack and orientation schedules shortly.\n\nBest wishes,\nCentre Administration"

    # 2. Activity-based Overrides
    activity_count = len(recent_activities)
    if activity_count > 0:
        latest_act = recent_activities[0]
        act_desc = latest_act.get('description', '').lower()
        if 'great' in act_desc or 'excellent' in act_desc or '100%' in act_desc:
            recommendation = f"Parent Alert: Mention child's excellent activity session today ('{latest_act.get('description')[:35]}...') to close the sale."
            priority = "High"
        elif 'cry' in act_desc or 'upset' in act_desc or 'refused' in act_desc:
            recommendation = f"Care Call Required: Address child's difficulty adapting to daycare ('{latest_act.get('description')[:35]}...')."
            priority = "High"
            
    # 3. Source-based fine-tuning
    if source == 'Teacher Dashboard' and status not in ['Confirmed', 'Seat Availability']:
        priority = "High"
        recommendation = "Teacher logged new progress. Message parent with developmental milestone update."
        
    return {
        "priority": priority,
        "recommendation": recommendation,
        "whatsapp_template": whatsapp_template,
        "email_subject": email_subject,
        "email_body": email_body
    }
