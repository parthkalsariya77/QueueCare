import { Database as DatabaseType } from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';

export function seedDatabase(db: DatabaseType) {
  // Drop tables to allow schema migrations
  db.exec(`
    DROP TABLE IF EXISTS queue_events;
    DROP TABLE IF EXISTS consultation_history;
    DROP TABLE IF EXISTS appointments;
    DROP TABLE IF EXISTS queues;
    DROP TABLE IF EXISTS doctors;
    DROP TABLE IF EXISTS departments;
    DROP TABLE IF EXISTS hospitals;
  `);

  // Execute schema
  db.exec(SCHEMA_SQL);

  const now = new Date();
  const formatTime = (d: Date) => d.toISOString();
  
  // Helpers for relative time strings
  const todayAt = (hours: number, minutes = 0) => {
    const d = new Date(now);
    d.setHours(hours, minutes, 0, 0);
    return formatTime(d);
  };

  const yesterdayAt = (hours: number, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(hours, minutes, 0, 0);
    return formatTime(d);
  };

  const tomorrowAt = (hours: number, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    return formatTime(d);
  };

  const dayAfterTomorrowAt = (hours: number, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(hours, minutes, 0, 0);
    return formatTime(d);
  };

  // 1. Insert Hospitals
  const insertHospital = db.prepare(`
    INSERT INTO hospitals (id, name, locality, city, description, phone, open_time, close_time, is_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHospital.run(
    1,
    'Zydus Super Specialty Hospital',
    'Thaltej - SG Highway',
    'Ahmedabad',
    'Premier multi-specialty tertiary care hospital known for modern diagnostic facilities, cardiology, and digital OPD queues.',
    '+91 79 6619 0000',
    '08:00',
    '20:00',
    1
  );

  insertHospital.run(
    2,
    'Apollo Clinic & Diagnostic Centre',
    'Sector 21',
    'Gandhinagar',
    'Comprehensive outpatient care, family medicine, pediatric clinic, and digital queue tokens.',
    '+91 79 2324 1200',
    '08:30',
    '19:30',
    1
  );

  insertHospital.run(
    3,
    'Civil Hospital Medicity OPD',
    'Asarwa',
    'Ahmedabad',
    'High-volume medical center with digitized token queues for routine consultations and specialized clinics.',
    '+91 79 2268 0074',
    '09:00',
    '17:00',
    1
  );

  insertHospital.run(
    4,
    'Shanti Community Health Hospital',
    'Navrangpura',
    'Ahmedabad',
    'Friendly urban clinic focused on internal medicine, orthopedics, dermatology, and elder care.',
    '+91 79 2640 4455',
    '08:00',
    '21:00',
    1
  );

  // 2. Insert Departments
  const insertDept = db.prepare(`
    INSERT INTO departments (id, hospital_id, name, description)
    VALUES (?, ?, ?, ?)
  `);

  // Zydus (1)
  insertDept.run(1, 1, 'General Medicine', 'Internal medicine, fever, routine health checks, and preventive care.');
  insertDept.run(2, 1, 'Cardiology', 'Heart health, hypertension monitoring, and cardiac outpatient consultations.');
  insertDept.run(3, 1, 'Orthopedics', 'Joint pains, fractures, sports injuries, and spine health.');

  // Apollo Gandhinagar (2)
  insertDept.run(4, 2, 'Pediatrics', 'Child healthcare, vaccinations, fever, and developmental checks.');
  insertDept.run(5, 2, 'General Medicine', 'Adult primary care and chronic illness monitoring.');
  insertDept.run(6, 2, 'Dermatology', 'Skin conditions, allergies, rashes, and laser consultations.');

  // Civil Hospital Medicity (3)
  insertDept.run(7, 3, 'General Medicine', 'High volume public medical OPD consultations.');
  insertDept.run(8, 3, 'ENT & Head-Neck', 'Ear, nose, throat, sinusitis, and audiology care.');
  insertDept.run(9, 3, 'Ophthalmology', 'Vision testing, eye infections, and cataract assessment.');

  // Shanti Community Hospital (4)
  insertDept.run(10, 4, 'General Medicine', 'Family physician consultations and preventive OPD.');
  insertDept.run(11, 4, 'Orthopedics', 'Bone and joint care with physiotherapy referral.');
  insertDept.run(12, 4, 'Gynecology', 'Women health, prenatal checkups, and routine wellness.');

  // 3. Insert Doctors
  const insertDoctor = db.prepare(`
    INSERT INTO doctors (id, hospital_id, department_id, name, specialization, default_avg_min)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Zydus
  insertDoctor.run(1, 1, 1, 'Dr. Rajesh Patel', 'MD (Internal Medicine) - 15 yrs exp', 8);
  insertDoctor.run(2, 1, 1, 'Dr. Neha Shah', 'MBBS, DNB (Medicine)', 7);
  insertDoctor.run(3, 1, 2, 'Dr. Vikramaditya Joshi', 'DM (Cardiology) - Senior Consultant', 12);
  insertDoctor.run(4, 1, 3, 'Dr. Aniket Mehta', 'MS (Orthopedics) - Joint Replacement', 11);

  // Apollo Gandhinagar
  insertDoctor.run(5, 2, 4, 'Dr. Priyanshi Dave', 'MD (Pediatrics) - Child Specialist', 9);
  insertDoctor.run(6, 2, 5, 'Dr. Hardik Desai', 'MD (General Medicine)', 8);
  insertDoctor.run(7, 2, 6, 'Dr. Ritu Trivedi', 'MD (Dermatology & Venereology)', 7);

  // Civil Medicity
  insertDoctor.run(8, 3, 7, 'Dr. Jayesh Parmar', 'MD (Medicine) - Unit Head', 6);
  insertDoctor.run(9, 3, 8, 'Dr. Snehal Vaghela', 'MS (ENT Specialist)', 8);
  insertDoctor.run(10, 3, 9, 'Dr. Bhavin Solanki', 'MS (Ophthalmology)', 7);

  // Shanti Community
  insertDoctor.run(11, 4, 10, 'Dr. Chirag Bhatt', 'MD (Family Physician)', 9);
  insertDoctor.run(12, 4, 11, 'Dr. Meera Iyer', 'D.Ortho - Orthopedic Surgeon', 10);
  insertDoctor.run(13, 4, 12, 'Dr. Sonal Sanghavi', 'MD, DGO (Obstetrics & Gynae)', 10);

  // 4. Insert Queues (one per doctor)
  const insertQueue = db.prepare(`
    INSERT INTO queues (id, hospital_id, department_id, doctor_id, status, delay_minutes, delay_reason, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Queues with realistic operational states
  insertQueue.run(1, 1, 1, 1, 'active', 5, 'Consultation running slightly over schedule', formatTime(now));
  insertQueue.run(2, 1, 1, 2, 'active', 0, null, formatTime(now));
  insertQueue.run(3, 1, 2, 3, 'active', 10, 'Attending emergency inpatient ECG review', formatTime(now));
  insertQueue.run(4, 1, 3, 4, 'active', 0, null, formatTime(now));

  insertQueue.run(5, 2, 4, 5, 'active', 0, null, formatTime(now));
  insertQueue.run(6, 2, 5, 6, 'active', 0, null, formatTime(now));
  insertQueue.run(7, 2, 6, 7, 'active', 0, null, formatTime(now));

  insertQueue.run(8, 3, 7, 8, 'active', 0, null, formatTime(now));
  insertQueue.run(9, 3, 8, 9, 'active', 0, null, formatTime(now));
  insertQueue.run(10, 3, 9, 10, 'paused', 0, 'Doctor on scheduled ward rounds', formatTime(now));

  insertQueue.run(11, 4, 10, 11, 'active', 0, null, formatTime(now));
  insertQueue.run(12, 4, 11, 12, 'active', 0, null, formatTime(now));
  insertQueue.run(13, 4, 12, 13, 'active', 0, null, formatTime(now));

  // 5. Seed Consultation History (15-20 records per doctor for adaptive learning)
  const insertHistory = db.prepare(`
    INSERT INTO consultation_history (doctor_id, department_id, duration_minutes, completed_at, source)
    VALUES (?, ?, ?, ?, ?)
  `);

  const sampleHistories: Record<number, number[]> = {
    1: [7.5, 8.0, 9.2, 7.0, 8.5, 6.8, 9.5, 8.2, 7.8, 8.8, 7.2, 8.1, 9.0, 8.4, 7.9],
    2: [6.5, 7.0, 6.8, 7.5, 6.2, 7.8, 7.1, 6.9, 7.4, 6.6, 7.0, 6.7, 7.3, 6.8, 7.2],
    3: [12.0, 14.5, 11.2, 13.0, 15.1, 11.8, 12.5, 13.8, 14.0, 12.2, 13.5, 11.0, 12.8, 14.2],
    4: [10.5, 11.2, 9.8, 12.0, 11.5, 10.8, 11.0, 12.4, 10.2, 11.8, 11.1, 10.6, 11.9],
    5: [8.5, 9.5, 8.8, 9.2, 10.0, 8.2, 9.0, 8.6, 9.8, 9.1, 8.9, 9.4, 8.7],
    6: [7.8, 8.2, 7.5, 8.0, 8.5, 7.9, 8.1, 7.7, 8.4, 8.0, 7.6, 8.3],
    7: [6.8, 7.2, 7.0, 6.5, 7.5, 6.9, 7.1, 7.4, 6.7, 7.0, 7.3],
    8: [5.5, 6.0, 5.8, 6.2, 5.2, 6.5, 5.9, 6.1, 5.7, 6.3, 5.4, 6.0],
    9: [7.5, 8.2, 7.8, 8.5, 7.9, 8.0, 8.4, 7.6, 8.1, 8.3],
    10: [6.5, 7.0, 6.8, 7.2, 6.7, 7.1, 6.9, 7.4, 6.6, 7.0],
    11: [8.5, 9.2, 8.8, 9.5, 8.2, 9.0, 8.7, 9.3, 8.9, 9.1],
    12: [10.0, 10.8, 9.5, 10.5, 11.0, 10.2, 10.7, 9.9, 10.4],
    13: [9.5, 10.2, 9.8, 10.5, 9.2, 10.0, 9.7, 10.3, 9.9]
  };

  const getDoctorDept = (docId: number) => {
    const row = db.prepare('SELECT department_id FROM doctors WHERE id = ?').get(docId) as { department_id: number };
    return row ? row.department_id : 1;
  };

  for (const [docIdStr, durations] of Object.entries(sampleHistories)) {
    const docId = Number(docIdStr);
    const deptId = getDoctorDept(docId);
    durations.forEach((duration, index) => {
      const pastTime = new Date(now.getTime() - (durations.length - index) * 45 * 60 * 1000);
      insertHistory.run(docId, deptId, duration, formatTime(pastTime), 'seed');
    });
  }

  // 6. Insert Diverse Appointments & Populate Active Queues
  const insertAppt = db.prepare(`
    INSERT INTO appointments (
      id, patient_id, patient_name, patient_phone, visit_reason, hospital_id, department_id, doctor_id, 
      token_number, queue_position, scheduled_time, status, created_at, checkin_at, consultation_start_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // --- Hospital 1, Dr. Rajesh Patel (General Medicine) Queue ---
  // In Consultation
  insertAppt.run(
    1,
    'patient-101',
    'Aarav Sharma',
    '+91 98980 11223',
    'Acute viral fever & persistent chills',
    1, 1, 1,
    'GEN-101',
    null,
    todayAt(9, 30),
    'in_consultation',
    todayAt(9, 0),
    todayAt(9, 20),
    todayAt(9, 35),
    null
  );

  // Waiting #1
  insertAppt.run(
    2,
    'patient-102',
    'Bhavna Patel',
    '+91 97240 33445',
    'Hypertension review and medication refill',
    1, 1, 1,
    'GEN-102',
    1,
    todayAt(9, 45),
    'waiting',
    todayAt(9, 10),
    todayAt(9, 30),
    null,
    null
  );

  // Waiting #2 — LOGGED-IN PATIENT: Rohan Mehta
  insertAppt.run(
    3,
    'demo-patient',
    'Rohan Mehta',
    '+91 98250 12345',
    'Chronic fatigue, post-lunch lethargy & routine checkup',
    1, 1, 1,
    'GEN-103',
    2,
    todayAt(10, 0),
    'waiting',
    todayAt(9, 15),
    todayAt(9, 40),
    null,
    null
  );

  // Waiting #3
  insertAppt.run(
    4,
    'patient-104',
    'Kiran Varma',
    '+91 99090 55667',
    'Gastric discomfort and digestive consultation',
    1, 1, 1,
    'GEN-104',
    3,
    todayAt(10, 15),
    'waiting',
    todayAt(9, 25),
    todayAt(9, 45),
    null,
    null
  );

  // Booked for later today (occupies 11:30 AM slot)
  insertAppt.run(
    5,
    'patient-105',
    'Siddharth Dave',
    '+91 98240 77889',
    'Routine executive wellness screening',
    1, 1, 1,
    'GEN-105',
    null,
    todayAt(11, 30),
    'booked',
    todayAt(8, 0),
    null,
    null,
    null
  );

  // Booked for later today (occupies 12:00 PM slot)
  insertAppt.run(
    6,
    'patient-106',
    'Ananya Trivedi',
    '+91 94260 22334',
    'Follow-up blood test result discussion',
    1, 1, 1,
    'GEN-106',
    null,
    todayAt(12, 0),
    'booked',
    todayAt(8, 30),
    null,
    null,
    null
  );

  // --- LOGGED-IN PATIENT (Rohan Mehta) Multi-Ticket Portfolio ---
  // 1. Booked for Later Today (Apollo Gandhinagar - Pediatrics) -> Demonstrates Pre-Checkin Departure Planning
  insertAppt.run(
    7,
    'demo-patient',
    'Rohan Mehta',
    '+91 98250 12345',
    'Child seasonal allergic cough & vaccination check',
    2, 4, 5,
    'PED-205',
    null,
    todayAt(15, 30),
    'booked',
    formatTime(now),
    null,
    null,
    null
  );

  // 2. Upcoming Tomorrow (Booked 10:30 AM at Zydus - Cardiology) -> Demonstrates future booking & rescheduling
  insertAppt.run(
    8,
    'demo-patient',
    'Rohan Mehta',
    '+91 98250 12345',
    'Preventive cardiovascular screening & ECG consultation',
    1, 2, 3,
    'CAR-304',
    null,
    tomorrowAt(10, 30),
    'booked',
    formatTime(now),
    null,
    null,
    null
  );

  // Completed Yesterday (Shanti Community - Family Medicine)
  insertAppt.run(
    9,
    'demo-patient',
    'Rohan Mehta',
    '+91 98250 12345',
    'Seasonal flu & throat irritation follow-up',
    4, 10, 11,
    'MED-091',
    null,
    yesterdayAt(15, 0),
    'completed',
    yesterdayAt(14, 0),
    yesterdayAt(14, 50),
    yesterdayAt(15, 0),
    yesterdayAt(15, 8)
  );

  // Completed Past (Apollo - Dermatology)
  insertAppt.run(
    10,
    'demo-patient',
    'Rohan Mehta',
    '+91 98250 12345',
    'Allergic skin rash consultation and topical ointment prescription',
    2, 6, 7,
    'DER-052',
    null,
    yesterdayAt(11, 0),
    'completed',
    yesterdayAt(10, 0),
    yesterdayAt(10, 45),
    yesterdayAt(11, 0),
    yesterdayAt(11, 7)
  );

  // Cancelled in history (Civil Medicity - ENT)
  insertAppt.run(
    11,
    'demo-patient',
    'Rohan Mehta',
    '+91 98250 12345',
    'Audiology assessment and ear cleaning',
    3, 8, 9,
    'ENT-015',
    null,
    yesterdayAt(10, 0),
    'cancelled',
    yesterdayAt(8, 0),
    null,
    null,
    null
  );

  // --- Other Doctors Queues to demonstrate live multi-doctor OPD activity ---
  // Dr. Vikramaditya Joshi (Zydus Cardiology)
  insertAppt.run(
    12,
    'patient-201',
    'Dinesh Shah',
    '+91 98790 44556',
    'Post-angioplasty routine evaluation',
    1, 2, 3,
    'CAR-301',
    1,
    todayAt(10, 0),
    'waiting',
    todayAt(9, 30),
    todayAt(9, 45),
    null,
    null
  );

  insertAppt.run(
    13,
    'patient-202',
    'Farida Mansuri',
    '+91 97120 88990',
    'Chest discomfort & elevated blood pressure review',
    1, 2, 3,
    'CAR-302',
    2,
    todayAt(10, 20),
    'waiting',
    todayAt(9, 35),
    todayAt(9, 50),
    null,
    null
  );

  insertAppt.run(
    14,
    'patient-203',
    'Mehul Prajapati',
    '+91 98980 99112',
    'Holter monitor review & heart rhythm check',
    1, 2, 3,
    'CAR-303',
    3,
    todayAt(10, 40),
    'waiting',
    todayAt(9, 45),
    todayAt(9, 55),
    null,
    null
  );

  // --- Hospital 2, Dr. Priyanshi Dave (Apollo Pediatrics) ---
  // In Consultation
  insertAppt.run(
    15,
    'patient-300',
    'Aaradhya Patel',
    '+91 99040 12341',
    'High fever and infant throat examination',
    2, 4, 5,
    'PED-201',
    null,
    todayAt(9, 30),
    'in_consultation',
    todayAt(9, 15),
    todayAt(9, 30),
    todayAt(9, 45),
    null
  );

  // Waiting #1
  insertAppt.run(
    16,
    'patient-301',
    'Pooja Shah',
    '+91 99250 33441',
    'Infant vaccination and growth milestones check',
    2, 4, 5,
    'PED-202',
    1,
    todayAt(10, 0),
    'waiting',
    todayAt(9, 30),
    todayAt(9, 50),
    null,
    null
  );

  // Waiting #2
  insertAppt.run(
    17,
    'patient-302',
    'Tirth Trivedi',
    '+91 98254 66778',
    'Persistent dry cough & wheezing consultation',
    2, 4, 5,
    'PED-203',
    2,
    todayAt(10, 30),
    'waiting',
    todayAt(9, 40),
    todayAt(9, 55),
    null,
    null
  );

  // --- Hospital 3, Dr. Snehal Vaghela (Civil Hospital Medicity ENT) ---
  // In Consultation
  insertAppt.run(
    18,
    'patient-401',
    'Ramesh Chawla',
    '+91 98251 77889',
    'Acute middle ear infection & sharp earache',
    3, 8, 9,
    'ENT-011',
    null,
    todayAt(9, 30),
    'in_consultation',
    todayAt(9, 10),
    todayAt(9, 30),
    todayAt(9, 42),
    null
  );

  // Waiting #1
  insertAppt.run(
    19,
    'patient-402',
    'Geeta Vaghela',
    '+91 94280 44551',
    'Sinusitis and chronic nasal blockage',
    3, 8, 9,
    'ENT-012',
    1,
    todayAt(10, 0),
    'waiting',
    todayAt(9, 20),
    todayAt(9, 45),
    null,
    null
  );

  // Waiting #2
  insertAppt.run(
    20,
    'patient-403',
    'Harish Solanki',
    '+91 97260 88992',
    'Throat soreness & hoarseness evaluation',
    3, 8, 9,
    'ENT-013',
    2,
    todayAt(10, 30),
    'waiting',
    todayAt(9, 35),
    todayAt(9, 52),
    null,
    null
  );

  // --- Hospital 4, Dr. Chirag Bhatt (Shanti Community Internal Medicine) ---
  // In Consultation
  insertAppt.run(
    21,
    'patient-501',
    'Kamlesh Mistry',
    '+91 98981 22334',
    'Seasonal flu and generalized body ache',
    4, 10, 11,
    'MED-081',
    null,
    todayAt(9, 30),
    'in_consultation',
    todayAt(9, 15),
    todayAt(9, 35),
    todayAt(9, 44),
    null
  );

  // Waiting #1
  insertAppt.run(
    22,
    'patient-502',
    'Lata Ben Patel',
    '+91 97140 55667',
    'Type 2 Diabetes routine quarterly glucose review',
    4, 10, 11,
    'MED-082',
    1,
    todayAt(10, 0),
    'waiting',
    todayAt(9, 25),
    todayAt(9, 48),
    null,
    null
  );

  // Waiting #2
  insertAppt.run(
    23,
    'patient-503',
    'Jayesh Barot',
    '+91 98259 88112',
    'Joint stiffness and mild uric acid evaluation',
    4, 10, 11,
    'MED-083',
    2,
    todayAt(10, 30),
    'waiting',
    todayAt(9, 35),
    todayAt(9, 55),
    null,
    null
  );

  // 7. Insert Initial Queue Events
  const insertEvent = db.prepare(`
    INSERT INTO queue_events (queue_id, event_type, message, created_at)
    VALUES (?, ?, ?, ?)
  `);

  insertEvent.run(1, 'CONSULTATION_STARTED', 'Dr. Rajesh Patel called Token GEN-101 into Chamber 1.', todayAt(9, 35));
  insertEvent.run(1, 'DELAY_ADDED', 'Staff added +5 min delay: Consultation running slightly over schedule.', todayAt(9, 45));
  insertEvent.run(3, 'DELAY_ADDED', 'Staff added +10 min delay: Attending emergency inpatient ECG review.', todayAt(9, 20));
  insertEvent.run(5, 'CONSULTATION_STARTED', 'Dr. Priyanshi Dave called Token PED-201 into Consultation Chamber.', todayAt(9, 45));
  insertEvent.run(9, 'CONSULTATION_STARTED', 'Dr. Snehal Vaghela called Token ENT-011 into Examination Room.', todayAt(9, 42));
  insertEvent.run(11, 'CONSULTATION_STARTED', 'Dr. Chirag Bhatt called Token MED-081 into Consultation Room.', todayAt(9, 44));
  insertEvent.run(10, 'QUEUE_PAUSED', 'Staff paused queue: Doctor on scheduled ward rounds.', todayAt(9, 0));

  console.log('Database seeded with rich, realistic clinical dataset!');
}
