-- MUNLY Conference Submissions Database Schema

CREATE TABLE IF NOT EXISTS conference_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conference_name TEXT NOT NULL,
    organizing_institution TEXT NOT NULL,
    city TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    description TEXT NOT NULL,
    submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    encrypted_yw_id TEXT NOT NULL
) STRICT;