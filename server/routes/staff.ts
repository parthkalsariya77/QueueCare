import { Router } from 'express';
import { db } from '../db/connection.js';
import { QueueService } from '../services/queue.service.js';
import { seedDatabase } from '../db/seed.js';

export const staffRouter = Router();

// GET /api/staff/overview - Dashboard data for staff
staffRouter.get('/overview', (req, res) => {
  try {
    const rawHospId = req.query.hospitalId ? Number(req.query.hospitalId) : 1;
    const hospitalId = isNaN(rawHospId) || rawHospId <= 0 ? 1 : rawHospId;

    // List of hospitals for the hospital picker
    const hospitals = db.prepare('SELECT id, name, locality FROM hospitals').all();

    // List of queues in the selected hospital
    const queues = db.prepare(`
      SELECT 
        q.id as queue_id,
        q.status,
        q.delay_minutes,
        q.delay_reason,
        d.id as doctor_id,
        d.name as doctor_name,
        d.specialization,
        dept.id as department_id,
        dept.name as department_name,
        (SELECT COUNT(*) FROM appointments WHERE doctor_id = d.id AND status = 'waiting') as waiting_count,
        (SELECT token_number FROM appointments WHERE doctor_id = d.id AND status = 'in_consultation' LIMIT 1) as serving_token
      FROM queues q
      JOIN doctors d ON d.id = q.doctor_id
      JOIN departments dept ON dept.id = q.department_id
      WHERE q.hospital_id = ?
    `).all(hospitalId);

    // General KPIs for selected hospital
    const waitingTotalRow = db.prepare(`
      SELECT COUNT(*) as count FROM appointments a
      WHERE a.hospital_id = ? AND a.status = 'waiting'
    `).get(hospitalId) as { count: number };

    const completedTotalRow = db.prepare(`
      SELECT COUNT(*) as count FROM appointments a
      WHERE a.hospital_id = ? AND a.status = 'completed'
    `).get(hospitalId) as { count: number };

    const inConsTotalRow = db.prepare(`
      SELECT COUNT(*) as count FROM appointments a
      WHERE a.hospital_id = ? AND a.status = 'in_consultation'
    `).get(hospitalId) as { count: number };

    res.json({
      success: true,
      data: {
        selectedHospitalId: hospitalId,
        hospitals,
        queues,
        stats: {
          waiting: waitingTotalRow.count,
          inConsultation: inConsTotalRow.count,
          completed: completedTotalRow.count
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/staff/start-consultation - Move next waiting patient to in_consultation
staffRouter.post('/start-consultation', (req, res) => {
  try {
    const { queueId } = req.body;
    const cleanQueueId = Number(queueId);
    if (!queueId || isNaN(cleanQueueId) || cleanQueueId <= 0) {
      return res.status(400).json({ success: false, error: 'Valid queueId is required.' });
    }

    const appt = QueueService.startNextConsultation(cleanQueueId);
    res.json({
      success: true,
      message: `Consultation started for ${appt.token_number}!`,
      data: appt
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/staff/complete-consultation - Complete active consultation with simulated duration
staffRouter.post('/complete-consultation', (req, res) => {
  try {
    const { appointmentId, durationMinutes } = req.body;
    const cleanApptId = Number(appointmentId);
    if (!appointmentId || isNaN(cleanApptId) || cleanApptId <= 0) {
      return res.status(400).json({ success: false, error: 'Valid appointmentId is required.' });
    }

    const duration = Math.max(1, Math.min(120, Number(durationMinutes) || 8));
    const appt = QueueService.completeConsultation(cleanApptId, duration);
    res.json({
      success: true,
      message: `Consultation for ${appt.token_number} completed. Historical duration recorded!`,
      data: appt
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/staff/set-delay - Add or update delay
staffRouter.post('/set-delay', (req, res) => {
  try {
    const { queueId, delayMinutes, reason } = req.body;
    const cleanQueueId = Number(queueId);
    if (!queueId || isNaN(cleanQueueId) || cleanQueueId <= 0) {
      return res.status(400).json({ success: false, error: 'Valid queueId is required.' });
    }

    const delay = Math.max(0, Math.min(240, Number(delayMinutes) || 0));
    QueueService.setDelay(cleanQueueId, delay, reason || null);
    res.json({
      success: true,
      message: `Delay updated to ${delay} mins.`
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/staff/toggle-pause - Pause or resume queue
staffRouter.post('/toggle-pause', (req, res) => {
  try {
    const { queueId, status, reason } = req.body;
    const cleanQueueId = Number(queueId);
    if (!queueId || isNaN(cleanQueueId) || cleanQueueId <= 0 || !status) {
      return res.status(400).json({ success: false, error: 'Valid queueId and status are required.' });
    }

    QueueService.setStatus(cleanQueueId, status, reason);
    res.json({
      success: true,
      message: `Queue status updated to ${status}.`
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/staff/mark-no-show - Mark patient as no show
staffRouter.post('/mark-no-show', (req, res) => {
  try {
    const { appointmentId } = req.body;
    const cleanApptId = Number(appointmentId);
    if (!appointmentId || isNaN(cleanApptId) || cleanApptId <= 0) {
      return res.status(400).json({ success: false, error: 'Valid appointmentId is required.' });
    }

    QueueService.markNoShow(cleanApptId);
    res.json({
      success: true,
      message: 'Appointment marked as No-Show.'
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/staff/reset-demo - Restore clean initial database state
staffRouter.post('/reset-demo', (req, res) => {
  try {
    seedDatabase(db);
    res.json({
      success: true,
      message: 'Demo dataset successfully restored to initial state!'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
