import csv
import io
import datetime
from flask import Flask, request, jsonify, make_response
from db import get_db_connection
from ai_rules import generate_suggestions

app = Flask(__name__, static_folder='static', static_url_path='')

# Serve index.html at root
@app.route('/')
def index():
    return app.send_static_file('index.html')

# Helper: Convert sqlite3.Row to dict
def row_to_dict(row):
    return dict(row) if row else None

# Helper: Get activities for an enquiry
def get_enquiry_activities(cursor, enquiry_id):
    cursor.execute("SELECT * FROM activities WHERE enquiry_id = ? ORDER BY timestamp DESC", (enquiry_id,))
    return [row_to_dict(r) for r in cursor.fetchall()]

# API: List all enquiries with filters & AI suggestions
@app.route('/api/enquiries', methods=['GET'])
def get_enquiries():
    status_filter = request.args.get('status')
    source_filter = request.args.get('source')
    owner_filter = request.args.get('owner')
    search_query = request.args.get('search')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM enquiries WHERE 1=1"
    params = []
    
    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)
    if source_filter:
        query += " AND source = ?"
        params.append(source_filter)
    if owner_filter:
        query += " AND owner = ?"
        params.append(owner_filter)
    if search_query:
        query += " AND (parent_name LIKE ? OR child_name LIKE ? OR contact_phone LIKE ? OR contact_email LIKE ?)"
        like_str = f"%{search_query}%"
        params.extend([like_str, like_str, like_str, like_str])
        
    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    enquiries_list = []
    for row in rows:
        enq = row_to_dict(row)
        # Fetch latest activities
        activities = get_enquiry_activities(cursor, enq['id'])
        # Enrich with AI suggestions
        ai_data = generate_suggestions(enq, activities)
        enq['ai_priority'] = ai_data['priority']
        enq['ai_recommendation'] = ai_data['recommendation']
        enq['whatsapp_template'] = ai_data['whatsapp_template']
        enq['email_subject'] = ai_data['email_subject']
        enq['email_body'] = ai_data['email_body']
        enquiries_list.append(enq)
        
    conn.close()
    return jsonify(enquiries_list)

# API: Get a specific enquiry details
@app.route('/api/enquiries/<int:enq_id>', methods=['GET'])
def get_enquiry(enq_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM enquiries WHERE id = ?", (enq_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Enquiry not found"}), 404
        
    enq = row_to_dict(row)
    activities = get_enquiry_activities(cursor, enq_id)
    ai_data = generate_suggestions(enq, activities)
    enq['ai_priority'] = ai_data['priority']
    enq['ai_recommendation'] = ai_data['recommendation']
    enq['whatsapp_template'] = ai_data['whatsapp_template']
    enq['email_subject'] = ai_data['email_subject']
    enq['email_body'] = ai_data['email_body']
    
    conn.close()
    return jsonify(enq)

# API: Create Parent Enquiry
@app.route('/api/enquiries', methods=['POST'])
def create_enquiry():
    data = request.json or {}
    parent_name = data.get('parent_name', '').strip()
    child_name = data.get('child_name', '').strip()
    child_age = data.get('child_age')
    contact_phone = data.get('contact_phone', '').strip()
    contact_email = data.get('contact_email', '').strip()
    source = data.get('source', 'Parent Enquiry').strip()
    owner = data.get('owner', 'Counsellor Sarah').strip()
    notes = data.get('notes', '').strip()
    status = data.get('status', 'Enquiry').strip()
    
    # Validation
    if not parent_name or not child_name or not contact_phone or not contact_email:
        return jsonify({"error": "Parent Name, Child Name, Phone, and Email are required fields."}), 400
        
    try:
        child_age = int(child_age)
        if child_age < 0 or child_age > 18:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Child Age must be a valid number between 0 and 18."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO enquiries (parent_name, child_name, child_age, contact_phone, contact_email, status, source, owner, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (parent_name, child_name, child_age, contact_phone, contact_email, status, source, owner, notes))
        enq_id = cursor.lastrowid
        
        # Insert action log
        cursor.execute('''
        INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
        VALUES (?, ?, ?)
        ''', (enq_id, f"Enquiry created via {source}. Status: {status}.", owner))
        
        # If created with status 'Tour', create a tour booking
        if status == 'Tour' and data.get('tour_date') and data.get('tour_time'):
            cursor.execute('''
            INSERT INTO tours (enquiry_id, tour_date, tour_time, status)
            VALUES (?, ?, ?, 'Scheduled')
            ''', (enq_id, data['tour_date'], data['tour_time']))
            cursor.execute('''
            INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
            VALUES (?, ?, ?)
            ''', (enq_id, f"Tour scheduled for {data['tour_date']} at {data['tour_time']}", owner))
            
        conn.commit()
        conn.close()
        return jsonify({"success": True, "id": enq_id}), 201
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

# API: Update enquiry status (Conversion workflow step)
@app.route('/api/enquiries/<int:enq_id>/status', methods=['PATCH'])
def update_status(enq_id):
    data = request.json or {}
    new_status = data.get('status')
    performed_by = data.get('performed_by', 'System')
    
    valid_statuses = ['Enquiry', 'Tour', 'Demo', 'Follow-up', 'Referral', 'Seat Availability', 'Confirmed']
    if new_status not in valid_statuses:
        return jsonify({"error": f"Invalid status. Must be one of {valid_statuses}"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM enquiries WHERE id = ?", (enq_id,))
    enq = cursor.fetchone()
    if not enq:
        conn.close()
        return jsonify({"error": "Enquiry not found"}), 404
        
    old_status = enq['status']
    
    try:
        # Update status & updated_at timestamp
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute('''
        UPDATE enquiries 
        SET status = ?, updated_at = ?
        WHERE id = ?
        ''', (new_status, now_str, enq_id))
        
        # Log conversion event
        cursor.execute('''
        INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
        VALUES (?, ?, ?)
        ''', (enq_id, f"Status changed from '{old_status}' to '{new_status}'.", performed_by))
        
        # If transitioning to Tour and tour date/time is provided
        if new_status == 'Tour' and data.get('tour_date') and data.get('tour_time'):
            cursor.execute('''
            INSERT INTO tours (enquiry_id, tour_date, tour_time, status)
            VALUES (?, ?, ?, 'Scheduled')
            ''', (enq_id, data['tour_date'], data['tour_time']))
            cursor.execute('''
            INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
            VALUES (?, ?, ?)
            ''', (enq_id, f"Tour scheduled for {data['tour_date']} at {data['tour_time']}", performed_by))
            
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Status updated to {new_status}."})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

# API: Update notes or owner
@app.route('/api/enquiries/<int:enq_id>/details', methods=['PATCH'])
def update_details(enq_id):
    data = request.json or {}
    notes = data.get('notes')
    owner = data.get('owner')
    performed_by = data.get('performed_by', 'System')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM enquiries WHERE id = ?", (enq_id,))
    enq = cursor.fetchone()
    if not enq:
        conn.close()
        return jsonify({"error": "Enquiry not found"}), 404
        
    try:
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if notes is not None:
            cursor.execute("UPDATE enquiries SET notes = ?, updated_at = ? WHERE id = ?", (notes, now_str, enq_id))
            cursor.execute("INSERT INTO action_logs (enquiry_id, action_taken, performed_by) VALUES (?, ?, ?)", 
                           (enq_id, "Updated enquiry notes.", performed_by))
        if owner is not None:
            cursor.execute("UPDATE enquiries SET owner = ?, updated_at = ? WHERE id = ?", (owner, now_str, enq_id))
            cursor.execute("INSERT INTO action_logs (enquiry_id, action_taken, performed_by) VALUES (?, ?, ?)", 
                           (enq_id, f"Assigned owner changed to {owner}.", performed_by))
            
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Enquiry details updated."})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

# API: Record activity (daycare routine / classroom activity)
@app.route('/api/enquiries/<int:enq_id>/activities', methods=['POST'])
def add_activity(enq_id):
    data = request.json or {}
    act_type = data.get('type') # 'daycare_routine' or 'classroom_activity'
    description = data.get('description', '').strip()
    logged_by = data.get('logged_by', 'Teacher').strip()
    
    if act_type not in ['daycare_routine', 'classroom_activity']:
        return jsonify({"error": "Activity type must be 'daycare_routine' or 'classroom_activity'."}), 400
        
    if not description:
        return jsonify({"error": "Description is required."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM enquiries WHERE id = ?", (enq_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "Enquiry not found"}), 404
        
    try:
        cursor.execute('''
        INSERT INTO activities (enquiry_id, type, description, logged_by)
        VALUES (?, ?, ?, ?)
        ''', (enq_id, act_type, description, logged_by))
        
        # Log to actions list
        cursor.execute('''
        INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
        VALUES (?, ?, ?)
        ''', (enq_id, f"Logged {act_type.replace('_', ' ')}: {description}", logged_by))
        
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

# API: Get timeline (Action logs + Activities)
@app.route('/api/enquiries/<int:enq_id>/timeline', methods=['GET'])
def get_timeline(enq_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute("SELECT * FROM enquiries WHERE id = ?", (enq_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "Enquiry not found"}), 404
        
    # Get action logs
    cursor.execute("SELECT * FROM action_logs WHERE enquiry_id = ? ORDER BY timestamp DESC", (enq_id,))
    logs = [row_to_dict(r) for r in cursor.fetchall()]
    
    # Get activities
    cursor.execute("SELECT * FROM activities WHERE enquiry_id = ? ORDER BY timestamp DESC", (enq_id,))
    activities = [row_to_dict(r) for r in cursor.fetchall()]
    
    # Get tours
    cursor.execute("SELECT * FROM tours WHERE enquiry_id = ? ORDER BY tour_date DESC, tour_time DESC", (enq_id,))
    tours = [row_to_dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return jsonify({
        "logs": logs,
        "activities": activities,
        "tours": tours
    })

# API: Get scheduled tours list for Calendar
@app.route('/api/tours', methods=['GET'])
def get_tours():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.*, e.parent_name, e.child_name, e.child_age, e.contact_phone, e.owner 
        FROM tours t
        JOIN enquiries e ON t.enquiry_id = e.id
        ORDER BY t.tour_date ASC, t.tour_time ASC
    ''')
    tours = [row_to_dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(tours)

# API: Schedule/Modify tour directly
@app.route('/api/tours', methods=['POST'])
def schedule_tour():
    data = request.json or {}
    enquiry_id = data.get('enquiry_id')
    tour_date = data.get('tour_date')
    tour_time = data.get('tour_time')
    status = data.get('status', 'Scheduled')
    performed_by = data.get('performed_by', 'System')
    
    if not enquiry_id or not tour_date or not tour_time:
        return jsonify({"error": "Enquiry ID, Date, and Time are required."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if enquiry exists
        cursor.execute("SELECT * FROM enquiries WHERE id = ?", (enquiry_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Enquiry not found"}), 404
            
        cursor.execute('''
            INSERT INTO tours (enquiry_id, tour_date, tour_time, status)
            VALUES (?, ?, ?, ?)
        ''', (enquiry_id, tour_date, tour_time, status))
        
        # Log to actions list
        cursor.execute('''
            INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
            VALUES (?, ?, ?)
        ''', (enquiry_id, f"Tour scheduled for {tour_date} at {tour_time}.", performed_by))
        
        # Automatically update status of enquiry to 'Tour' if it's 'Enquiry'
        cursor.execute("SELECT status FROM enquiries WHERE id = ?", (enquiry_id,))
        curr_status = cursor.fetchone()['status']
        if curr_status == 'Enquiry':
            cursor.execute("UPDATE enquiries SET status = 'Tour', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (enquiry_id,))
            cursor.execute("INSERT INTO action_logs (enquiry_id, action_taken, performed_by) VALUES (?, 'Status auto-updated to Tour.', ?)", (enquiry_id, performed_by))
            
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

# API: Export enquiries as CSV
@app.route('/api/reports/export', methods=['GET'])
def export_csv():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM enquiries ORDER BY created_at DESC")
    rows = cursor.fetchall()
    
    si = io.StringIO()
    cw = csv.writer(si)
    
    # Write header
    cw.writerow(['ID', 'Parent Name', 'Child Name', 'Child Age', 'Contact Phone', 'Contact Email', 'Status', 'Source', 'Owner', 'Notes', 'Created At', 'Updated At'])
    
    for row in rows:
        cw.writerow([
            row['id'],
            row['parent_name'],
            row['child_name'],
            row['child_age'],
            row['contact_phone'],
            row['contact_email'],
            row['status'],
            row['source'],
            row['owner'],
            row['notes'],
            row['created_at'],
            row['updated_at']
        ])
        
    conn.close()
    
    response = make_response(si.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=enquiries_report.csv'
    response.headers['Content-Type'] = 'text/csv'
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5000)
