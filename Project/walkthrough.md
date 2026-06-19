# Walkthrough - Centre Tour Booking Calendar

We have built a fully functional end-to-end working prototype of the **Centre Tour Booking Calendar**.

The prototype successfully implements the admission conversion funnel (from Enquiry to Confirmed Admission) using a **Python Flask backend**, a **SQLite database**, and a **premium single-page HTML/CSS/JS frontend**.

---

## 🛠️ Changes Implemented

### 1. Database Schema (`db.py`)
- Created a relational SQLite database file `centre_tour.db`.
- Schema defines tables for `enquiries`, `tours`, `activities` (daycare & classroom), and `action_logs` (audit logs).
- Pre-seeded initial dataset for instant visualization in the dashboard.

### 2. Rule-Based AI Engine (`ai_rules.py`)
- Standardized conversion logic:
  - Dynamically assigns priority (High, Medium, Low) based on elapsed time, age group, or teacher logs.
  - Automatically recommends specific next actions for counsellors (e.g. "Prepare toddler program packet").
  - Generates template notifications tailored to the child's funnel stage.

### 3. Backend REST APIs (`app.py` & `test_api.py`)
- Implemented Flask API routes handling lead ingestion, state updates, tour scheduling, child activity recording, audit trails, and CSV reports generation.
- Verified and checked all backend routes using Python `unittest` test suite (`test_api.py`), achieving 100% test pass rate.

### 4. Interactive Single Page Frontend (`static/`)
- **`index.html`**: Layout incorporating stats indicators, a Kanban Pipeline, visual Tour Calendar, Teacher portal feed, and simulated WhatsApp/Email screen dashboards.
- **`app.js`**: Reacts dynamically to HTML5 Drag and Drop events, coordinates state across forms and calendar cell grids, and manages interactive notification dispatches.
- **`style.css`**: Configured high-contrast glassmorphism theme, smooth animations, and resolved cross-browser compatibility issues (specifically adding `background-clip: text` alongside the webkit-prefixed variant).

---

## 🔬 How to Run and Verify the Prototype

### Step 1: Run the Backend Server
The server is currently running in the background at:
`http://127.0.0.1:5000`

If you need to start it manually in the future, run:
```powershell
python app.py
```

### Step 2: Open in your Browser
Open your browser and navigate to:
[http://127.0.0.1:5000](http://127.0.0.1:5000)

### Step 3: Run the User Flows
1. **Parent Enquiry**: Click **"New Enquiry"**, fill out details, and save. Check that the card appears instantly on the board.
2. **Schedule Tour**: Select a card in "Enquiries", click its **calendar icon**, select a date and time, and click "Book Tour". Check that it automatically moves to "Tour Scheduled" and renders on the visual calendar.
3. **Move Conversion Funnel**: Drag a card across the columns (e.g., from Tour -> Demo -> Follow-up). Open **"Inspect Timeline"** to view the live audit trail and AI recommendations.
4. **Log Daycare/Classroom Activities**: Click **"Teacher Dashboard"** in the sidebar. Select a student, type routine notes (e.g., "Ate all vegetables. Slept soundly."), and save. Go back to inspect the child's timeline to verify the routine log is captured.
5. **Dispatch Simulated Messaging Alerts**: Click **"Messaging Hub"**, select a child, view their template drafts, and click **"Simulate Send WhatsApp Message"**. The simulated screen will animate and post the message block.
6. **Export Data**: Click **"Export CSV"** in the top header bar to download a report of all admission leads.
