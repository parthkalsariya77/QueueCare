import { Router } from 'express';
import { db } from '../db/connection.js';
import { QueueService } from '../services/queue.service.js';
import { calculateAppointmentETA } from '../services/eta.service.js';

export const appointmentRouter = Router();

// GET /api/appointments - List appointments for patient
appointmentRouter.get('/', (req, res) => {
  try {
    const patientId = (req.query.patientId as string) || 'demo-patient';
    const status = req.query.status as string;

    let query = `
      SELECT 
        a.*,
        h.name as hospital_name,
        h.locality as locality,
        dept.name as department_name,
        d.name as doctor_name,
        q.id as queue_id
      FROM appointments a
      JOIN hospitals h ON h.id = a.hospital_id
      JOIN departments dept ON dept.id = a.department_id
      JOIN doctors d ON d.id = a.doctor_id
      LEFT JOIN queues q ON q.doctor_id = a.doctor_id
      WHERE a.patient_id = ?
    `;
    const params: any[] = [patientId];

    if (status && status !== 'all') {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY datetime(a.scheduled_time) DESC`;

    const appointments = db.prepare(query).all(...params);
    res.json({ success: true, count: appointments.length, data: appointments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/appointments/:id - Single appointment with live calculated ETA
appointmentRouter.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid appointment ID.' });
    }
    const appointment = db.prepare(`
      SELECT 
        a.*,
        h.name as hospital_name,
        h.locality as locality,
        dept.name as department_name,
        d.name as doctor_name,
        q.id as queue_id
      FROM appointments a
      JOIN hospitals h ON h.id = a.hospital_id
      JOIN departments dept ON dept.id = a.department_id
      JOIN doctors d ON d.id = a.doctor_id
      LEFT JOIN queues q ON q.doctor_id = a.doctor_id
      WHERE a.id = ?
    `).get(id) as any;

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found.' });
    }

    const eta = calculateAppointmentETA(id);
    const events = appointment.queue_id ? QueueService.getQueueEvents(appointment.queue_id, 5) : [];

    res.json({
      success: true,
      data: {
        ...appointment,
        eta,
        events
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/appointments - Book new appointment
appointmentRouter.post('/', (req, res) => {
  try {
    const { hospitalId, departmentId, doctorId, scheduledTime, patientName, patientPhone, visitReason } = req.body;

    if (!hospitalId || !departmentId || !doctorId || !scheduledTime) {
      return res.status(400).json({ success: false, error: 'Missing required appointment booking fields.' });
    }

    // Double-booking collision guard: ensure slot is not already booked for this doctor
    const existingSlot = db.prepare(`
      SELECT id, token_number FROM appointments
      WHERE doctor_id = ? AND scheduled_time = ? AND status NOT IN ('cancelled')
    `).get(doctorId, scheduledTime) as { id: number; token_number: string } | undefined;

    if (existingSlot) {
      return res.status(409).json({
        success: false,
        error: 'This appointment slot has already been booked. Please choose an available slot.'
      });
    }

    const department = db.prepare('SELECT name FROM departments WHERE id = ?').get(departmentId) as any;
    const prefix = department ? department.name.slice(0, 3).toUpperCase() : 'MED';

    // Generate token number safely (strictly increasing to avoid token collisions)
    const maxTokenRow = db.prepare(`
      SELECT MAX(CAST(SUBSTR(token_number, INSTR(token_number, '-') + 1) AS INTEGER)) as max_token
      FROM appointments WHERE department_id = ?
    `).get(departmentId) as { max_token: number | null };

    const nextTokenNum = (maxTokenRow && maxTokenRow.max_token && maxTokenRow.max_token >= 100)
      ? maxTokenRow.max_token + 1
      : 101;

    const tokenNumber = `${prefix}-${nextTokenNum}`;

    const insertResult = db.prepare(`
      INSERT INTO appointments (
        patient_id, patient_name, patient_phone, visit_reason, hospital_id, department_id, doctor_id, 
        token_number, scheduled_time, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', datetime('now'))
    `).run(
      'demo-patient',
      patientName || 'Rohan Mehta',
      patientPhone || '+91 98250 12345',
      visitReason || 'General Consultation',
      hospitalId,
      departmentId,
      doctorId,
      tokenNumber,
      scheduledTime
    );

    const newAppt = db.prepare(`
      SELECT 
        a.*,
        h.name as hospital_name,
        dept.name as department_name,
        d.name as doctor_name,
        q.id as queue_id
      FROM appointments a
      JOIN hospitals h ON h.id = a.hospital_id
      JOIN departments dept ON dept.id = a.department_id
      JOIN doctors d ON d.id = a.doctor_id
      LEFT JOIN queues q ON q.doctor_id = a.doctor_id
      WHERE a.id = ?
    `).get(insertResult.lastInsertRowid) as any;

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully!',
      data: newAppt
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/appointments/:id/checkin - Check in to active queue
appointmentRouter.post('/:id/checkin', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid appointment ID.' });
    }
    const updated = QueueService.checkIn(id);
    const eta = calculateAppointmentETA(id);
    res.json({
      success: true,
      message: 'Successfully checked in to queue!',
      data: { ...updated, eta }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/appointments/:id/cancel - Cancel appointment
appointmentRouter.post('/:id/cancel', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid appointment ID.' });
    }
    const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
    if (!appt) return res.status(404).json({ success: false, error: 'Appointment not found.' });

    if (appt.status === 'completed' || appt.status === 'in_consultation') {
      return res.status(400).json({ success: false, error: `Cannot cancel appointment in status ${appt.status}.` });
    }

    db.prepare(`
      UPDATE appointments 
      SET status = 'cancelled', queue_position = NULL 
      WHERE id = ?
    `).run(id);

    // Re-index remaining waiting appointments if it was waiting
    if (appt.status === 'waiting') {
      const remaining = db.prepare(`
        SELECT id FROM appointments 
        WHERE doctor_id = ? AND status = 'waiting' 
        ORDER BY queue_position ASC
      `).all(appt.doctor_id) as { id: number }[];
      
      const updateStmt = db.prepare('UPDATE appointments SET queue_position = ? WHERE id = ?');
      remaining.forEach((r, idx) => updateStmt.run(idx + 1, r.id));
    }

    res.json({ success: true, message: 'Appointment cancelled successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/appointments/:id/reschedule - Reschedule appointment
appointmentRouter.post('/:id/reschedule', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid appointment ID.' });
    }
    const { newScheduledTime } = req.body;
    if (!newScheduledTime) {
      return res.status(400).json({ success: false, error: 'newScheduledTime is required.' });
    }

    const updated = QueueService.reschedule(id, newScheduledTime);
    res.json({
      success: true,
      message: 'Appointment rescheduled successfully!',
      data: updated
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
