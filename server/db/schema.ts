export const SCHEMA_SQL = `
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  locality TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Ahmedabad',
  description TEXT,
  phone TEXT,
  open_time TEXT DEFAULT '08:00',
  close_time TEXT DEFAULT '20:00',
  is_open INTEGER DEFAULT 1
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT
);

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialization TEXT,
  default_avg_min INTEGER DEFAULT 10
);

-- Queues table (One active queue per doctor)
CREATE TABLE IF NOT EXISTS queues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL UNIQUE REFERENCES doctors(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused')),
  delay_minutes INTEGER DEFAULT 0,
  delay_reason TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL DEFAULT 'demo-patient',
  patient_name TEXT NOT NULL DEFAULT 'Rohan Mehta',
  patient_phone TEXT DEFAULT '+91 98250 12345',
  visit_reason TEXT,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  token_number TEXT NOT NULL,
  queue_position INTEGER,
  scheduled_time TEXT NOT NULL,
  status TEXT DEFAULT 'booked' 
    CHECK(status IN ('booked','waiting','in_consultation','completed','cancelled','rescheduled','no_show')),
  created_at TEXT DEFAULT (datetime('now')),
  checkin_at TEXT,
  consultation_start_at TEXT,
  completed_at TEXT
);

-- Consultation history table (stores actual / synthetic duration observations for ETA learning)
CREATE TABLE IF NOT EXISTS consultation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  duration_minutes REAL NOT NULL,
  completed_at TEXT DEFAULT (datetime('now')),
  source TEXT DEFAULT 'seed' CHECK(source IN ('seed','simulated'))
);

-- Queue events table (audit log for live feed)
CREATE TABLE IF NOT EXISTS queue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_consultation_history_doctor ON consultation_history(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_events_queue ON queue_events(queue_id);
`;
