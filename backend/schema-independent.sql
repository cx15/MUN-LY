-- MUNLY Independent Backend Database Schema
-- This schema removes Youware dependencies and adds independent authentication

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
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    -- Optional fields for enhanced functionality
    website_url TEXT,
    registration_deadline TEXT,
    expected_participants INTEGER,
    conference_fee REAL,
    committees TEXT, -- JSON array of committee names
    special_features TEXT, -- JSON array of special features
    
    -- Metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conference_status ON conference_submissions(status);
CREATE INDEX IF NOT EXISTS idx_conference_date ON conference_submissions(start_date);
CREATE INDEX IF NOT EXISTS idx_conference_city ON conference_submissions(city);
CREATE INDEX IF NOT EXISTS idx_conference_submitted_at ON conference_submissions(submitted_at);

-- Optional: Admin users table for independent authentication
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Use bcrypt or similar
    api_key TEXT UNIQUE,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'moderator')),
    active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
) STRICT;

-- Create index for admin authentication
CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_api_key ON admin_users(api_key);

-- Optional: Settings table for application configuration
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Insert default settings
INSERT OR IGNORE INTO app_settings (key, value, description) VALUES
('site_name', 'MUNLY', 'Website name'),
('contact_email', 'info@munly.ly', 'Main contact email'),
('max_submissions_per_day', '50', 'Maximum conference submissions per day'),
('auto_approve', 'false', 'Automatically approve conference submissions'),
('notification_email', '', 'Email address for notifications');

-- Optional: Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    user_id INTEGER,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);