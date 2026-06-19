import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'centre_tour.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Enquiries table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_name TEXT NOT NULL,
        child_name TEXT NOT NULL,
        child_age INTEGER NOT NULL,
        contact_phone TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        owner TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create Tours table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enquiry_id INTEGER NOT NULL,
        tour_date TEXT NOT NULL,
        tour_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Scheduled',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
    )
    ''')
    
    # Create Activities (Daycare routine & Classroom activity) table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enquiry_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'daycare_routine' or 'classroom_activity'
        description TEXT NOT NULL,
        logged_by TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
    )
    ''')
    
    # Create Action Logs table for history tracking
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enquiry_id INTEGER NOT NULL,
        action_taken TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
    )
    ''')
    
    conn.commit()
    
    # Add seed data if enquiries is empty
    cursor.execute("SELECT COUNT(*) FROM enquiries")
    if cursor.fetchone()[0] == 0:
        seed_data(cursor)
        conn.commit()
        
    conn.close()
    print("Database initialized successfully.")

def seed_data(cursor):
    # Insert initial enquiries
    enquiries = [
        ("Alice Johnson", "Emily Johnson", 4, "+1234567890", "alice@example.com", "Enquiry", "Parent Enquiry", "Counsellor Sarah", "Interested in morning preschool session."),
        ("Bob Smith", "Jake Smith", 3, "+1987654321", "bob@example.com", "Tour", "Parent Portal", "Counsellor Michael", "Wants to see the playground facilities."),
        ("Carol White", "Lily White", 5, "+1555019922", "carol@example.com", "Demo", "Counsellor Follow-up", "Counsellor Sarah", "Attending Saturday sandbox class trial."),
        ("David Miller", "Lucas Miller", 2, "+1555018833", "david@example.com", "Follow-up", "Teacher Dashboard", "Counsellor Michael", "Transitioning from infants to toddlers division."),
        ("sampath", "Oliver Green", 4, "+1555017744", "sampath@example.com", "Seat Availability", "Parent Enquiry", "Counsellor Sarah", "Requested details about transport services."),
        ("Frank Carter", "Sophia Carter", 5, "+1555016655", "frank@example.com", "Confirmed", "Referral", "Counsellor Michael", "Sibling is already enrolled in junior primary.")
    ]
    
    for enq in enquiries:
        cursor.execute('''
        INSERT INTO enquiries (parent_name, child_name, child_age, contact_phone, contact_email, status, source, owner, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', enq)
        enq_id = cursor.lastrowid
        
        # Log initial action
        cursor.execute('''
        INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
        VALUES (?, 'Enquiry created via ' || ?, ?)
        ''', (enq_id, enq[6], enq[7]))
        
        # If status is Tour, seed a tour record
        if enq[5] == "Tour":
            cursor.execute('''
            INSERT INTO tours (enquiry_id, tour_date, tour_time, status)
            VALUES (?, '2026-06-25', '10:00', 'Scheduled')
            ''', (enq_id,))
            cursor.execute('''
            INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
            VALUES (?, 'Tour scheduled for 2026-06-25 at 10:00', ?)
            ''', (enq_id, enq[7]))
            
        # If status is Demo, seed a tour and activities
        elif enq[5] == "Demo":
            cursor.execute('''
            INSERT INTO tours (enquiry_id, tour_date, tour_time, status)
            VALUES (?, '2026-06-15', '11:30', 'Completed')
            ''', (enq_id,))
            cursor.execute('''
            INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
            VALUES (?, 'Tour completed on 2026-06-15', ?)
            ''', (enq_id, enq[7]))
            cursor.execute('''
            INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
            VALUES (?, 'Moved to Demo stage', ?)
            ''', (enq_id, enq[7]))
            
        elif enq[5] == "Follow-up":
            # Add some daycare/classroom routine activity
            cursor.execute('''
            INSERT INTO activities (enquiry_id, type, description, logged_by)
            VALUES (?, 'daycare_routine', 'Jake had a great lunchtime. Ate 100% of his meal.', 'Teacher Jenny')
            ''', (enq_id,))
            cursor.execute('''
            INSERT INTO action_logs (enquiry_id, action_taken, performed_by)
            VALUES (?, 'Daycare routine logged: Jake had a great lunchtime...', 'Teacher Jenny')
            ''', (enq_id,))

if __name__ == "__main__":
    init_db()
