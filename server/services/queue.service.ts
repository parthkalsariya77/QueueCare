import { db } from '../db/connection.js';
import { Appointment, QueueEvent, QueueStatus } from '../../shared/types.js';

export class QueueService {
  /**
   * Log an operational event for the queue audit feed.
   */
  static logEvent(queueId: number, eventType: string, message: string): void {
    db.prepare(`
      INSERT INTO queue_events (queue_id, event_type, message, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(queueId, eventType, message);
  }

  /**
   * Patient check-in: transitions 'booked' -> 'waiting' and assigns queue position.
   */
  static checkIn(appointmentId: number): Appointment {
    return db.transaction(() => {
      const appt = db.prepare(`
        SELECT a.*, q.id as queue_id 
        FROM appointments a
        JOIN queues q ON q.doctor_id = a.doctor_id
        WHERE a.id = ?
      `).get(appointmentId) as any;

      if (!appt) {
        throw new Error('Appointment not found.');
      }
      if (appt.status !== 'booked') {
        throw new Error(`Cannot check in appointment with status: ${appt.status}`);
      }

      // Determine next queue position for this doctor
      const maxPosRow = db.prepare(`
        SELECT COALESCE(MAX(queue_position), 0) as max_pos
        FROM appointments
        WHERE doctor_id = ? AND status = 'waiting'
      `).get(appt.doctor_id) as { max_pos: number };

      const newPosition = maxPosRow.max_pos + 1;

      db.prepare(`
        UPDATE appointments
        SET status = 'waiting',
            queue_position = ?,
            checkin_at = datetime('now')
        WHERE id = ?
      `).run(newPosition, appointmentId);

      this.logEvent(
        appt.queue_id,
        'PATIENT_CHECKED_IN',
        `Patient ${appt.patient_name} (Token ${appt.token_number}) checked in at position #${newPosition}.`
      );

      return db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as Appointment;
    })();
  }

  /**
   * Staff calls next patient: transitions next 'waiting' -> 'in_consultation'.
   */
  static startNextConsultation(queueId: number): Appointment {
    return db.transaction(() => {
      const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(queueId) as any;
      if (!queue) throw new Error('Queue not found.');

      // Check if a patient is already in consultation for this doctor
      const activeCurrent = db.prepare(`
        SELECT * FROM appointments
        WHERE doctor_id = ? AND status = 'in_consultation'
      `).get(queue.doctor_id) as any;

      if (activeCurrent) {
        throw new Error(`Token ${activeCurrent.token_number} is already in consultation. Please complete it first.`);
      }

      // Find next waiting patient with lowest queue position
      const nextWaiting = db.prepare(`
        SELECT * FROM appointments
        WHERE doctor_id = ? AND status = 'waiting'
        ORDER BY queue_position ASC, datetime(checkin_at) ASC
        LIMIT 1
      `).get(queue.doctor_id) as any;

      if (!nextWaiting) {
        throw new Error('No waiting patients in this queue.');
      }

      // Move to in_consultation
      db.prepare(`
        UPDATE appointments
        SET status = 'in_consultation',
            queue_position = NULL,
            consultation_start_at = datetime('now')
        WHERE id = ?
      `).run(nextWaiting.id);

      // Re-index remaining waiting patients: 1, 2, 3...
      const remainingWaiting = db.prepare(`
        SELECT id FROM appointments
        WHERE doctor_id = ? AND status = 'waiting'
        ORDER BY queue_position ASC, datetime(checkin_at) ASC
      `).all(queue.doctor_id) as { id: number }[];

      const updatePos = db.prepare('UPDATE appointments SET queue_position = ? WHERE id = ?');
      remainingWaiting.forEach((r, idx) => {
        updatePos.run(idx + 1, r.id);
      });

      this.logEvent(
        queueId,
        'CONSULTATION_STARTED',
        `Consultation started for Token ${nextWaiting.token_number} (${nextWaiting.patient_name}).`
      );

      return db.prepare('SELECT * FROM appointments WHERE id = ?').get(nextWaiting.id) as Appointment;
    })();
  }

  /**
   * Staff completes consultation: records simulated or actual duration into history
   * and marks appointment as completed.
   */
  static completeConsultation(appointmentId: number, durationMinutes: number): Appointment {
    return db.transaction(() => {
      const appt = db.prepare(`
        SELECT a.*, q.id as queue_id 
        FROM appointments a
        JOIN queues q ON q.doctor_id = a.doctor_id
        WHERE a.id = ?
      `).get(appointmentId) as any;

      if (!appt) throw new Error('Appointment not found.');
      if (appt.status !== 'in_consultation') {
        throw new Error(`Cannot complete appointment with status: ${appt.status}. Must be 'in_consultation'.`);
      }

      const validDuration = Math.max(1, Math.min(60, Number(durationMinutes) || 8));

      // Mark appointment completed
      db.prepare(`
        UPDATE appointments
        SET status = 'completed',
            completed_at = datetime('now')
        WHERE id = ?
      `).run(appointmentId);

      // Record in consultation history for ETA engine learning
      db.prepare(`
        INSERT INTO consultation_history (doctor_id, department_id, duration_minutes, completed_at, source)
        VALUES (?, ?, ?, datetime('now'), 'simulated')
      `).run(appt.doctor_id, appt.department_id, validDuration);

      this.logEvent(
        appt.queue_id,
        'CONSULTATION_COMPLETED',
        `Consultation finished for Token ${appt.token_number} (Simulated duration: ${validDuration} mins).`
      );

      return db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as Appointment;
    })();
  }

  /**
   * Set delay in minutes and reason on a queue.
   */
  static setDelay(queueId: number, delayMinutes: number, reason: string | null): void {
    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(queueId) as any;
    if (!queue) throw new Error('Queue not found.');

    const minutes = Math.max(0, Number(delayMinutes) || 0);
    db.prepare(`
      UPDATE queues
      SET delay_minutes = ?,
          delay_reason = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(minutes, reason || (minutes > 0 ? 'Operational delay' : null), queueId);

    const msg = minutes > 0
      ? `Staff added +${minutes} min delay: ${reason || 'Operational delay'}.`
      : 'Staff cleared queue delay.';

    this.logEvent(queueId, 'DELAY_UPDATED', msg);
  }

  /**
   * Pause or resume queue.
   */
  static setStatus(queueId: number, status: QueueStatus, reason?: string): void {
    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(queueId) as any;
    if (!queue) throw new Error('Queue not found.');

    db.prepare(`
      UPDATE queues
      SET status = ?,
          delay_reason = CASE WHEN ? = 'paused' THEN ? ELSE delay_reason END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(status, status, reason || 'Queue paused by staff', queueId);

    const msg = status === 'paused'
      ? `Queue paused: ${reason || 'Doctor temporarily unavailable'}.`
      : 'Queue resumed normal operations.';

    this.logEvent(queueId, status === 'paused' ? 'QUEUE_PAUSED' : 'QUEUE_RESUMED', msg);
  }

  /**
   * Mark waiting appointment as no-show and re-order remaining queue.
   */
  static markNoShow(appointmentId: number): void {
    db.transaction(() => {
      const appt = db.prepare(`
        SELECT a.*, q.id as queue_id 
        FROM appointments a
        JOIN queues q ON q.doctor_id = a.doctor_id
        WHERE a.id = ?
      `).get(appointmentId) as any;

      if (!appt) throw new Error('Appointment not found.');
      if (appt.status !== 'waiting' && appt.status !== 'booked') {
        throw new Error('Can only mark booked or waiting appointments as no-show.');
      }

      db.prepare(`
        UPDATE appointments
        SET status = 'no_show',
            queue_position = NULL
        WHERE id = ?
      `).run(appointmentId);

      // Re-index remaining waiting appointments
      const remainingWaiting = db.prepare(`
        SELECT id FROM appointments
        WHERE doctor_id = ? AND status = 'waiting'
        ORDER BY queue_position ASC, datetime(checkin_at) ASC
      `).all(appt.doctor_id) as { id: number }[];

      const updatePos = db.prepare('UPDATE appointments SET queue_position = ? WHERE id = ?');
      remainingWaiting.forEach((r, idx) => {
        updatePos.run(idx + 1, r.id);
      });

      this.logEvent(
        appt.queue_id,
        'NO_SHOW',
        `Token ${appt.token_number} (${appt.patient_name}) was marked as No-Show. Queue advanced forward (safety margin active for remaining tokens).`
      );
    })();
  }

  /**
   * Reschedule appointment to a new slot time.
   */
  static reschedule(appointmentId: number, newTime: string): Appointment {
    return db.transaction(() => {
      const appt = db.prepare(`
        SELECT a.*, q.id as queue_id 
        FROM appointments a
        JOIN queues q ON q.doctor_id = a.doctor_id
        WHERE a.id = ?
      `).get(appointmentId) as any;

      if (!appt) throw new Error('Appointment not found.');
      if (appt.status === 'completed' || appt.status === 'in_consultation') {
        throw new Error(`Cannot reschedule appointment with status: ${appt.status}`);
      }

      // Ensure target slot is not already booked by another active appointment for this doctor
      const existingSlot = db.prepare(`
        SELECT id FROM appointments
        WHERE doctor_id = ? AND scheduled_time = ? AND id != ? AND status NOT IN ('cancelled')
      `).get(appt.doctor_id, newTime, appointmentId);

      if (existingSlot) {
        throw new Error('This time slot is already booked. Please choose an available slot.');
      }

      db.prepare(`
        UPDATE appointments
        SET scheduled_time = ?,
            status = 'booked',
            queue_position = NULL,
            checkin_at = NULL
        WHERE id = ?
      `).run(newTime, appointmentId);

      // Re-index waiting if it was waiting
      if (appt.status === 'waiting') {
        const remainingWaiting = db.prepare(`
          SELECT id FROM appointments
          WHERE doctor_id = ? AND status = 'waiting'
          ORDER BY queue_position ASC, datetime(checkin_at) ASC
        `).all(appt.doctor_id) as { id: number }[];

        const updatePos = db.prepare('UPDATE appointments SET queue_position = ? WHERE id = ?');
        remainingWaiting.forEach((r, idx) => {
          updatePos.run(idx + 1, r.id);
        });
      }

      this.logEvent(
        appt.queue_id,
        'RESCHEDULED',
        `Token ${appt.token_number} (${appt.patient_name}) was rescheduled to ${new Date(newTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
      );

      return db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as Appointment;
    })();
  }

  /**
   * Retrieve active queue entries for staff queue console.
   */
  static getQueueEntries(queueId: number): any[] {
    const queue = db.prepare('SELECT * FROM queues WHERE id = ?').get(queueId) as any;
    if (!queue) return [];

    return db.prepare(`
      SELECT 
        a.*,
        h.name as hospital_name,
        dept.name as department_name,
        d.name as doctor_name
      FROM appointments a
      JOIN hospitals h ON h.id = a.hospital_id
      JOIN departments dept ON dept.id = a.department_id
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.doctor_id = ? 
        AND a.status IN ('in_consultation', 'waiting', 'booked')
      ORDER BY 
        CASE 
          WHEN a.status = 'in_consultation' THEN 1
          WHEN a.status = 'waiting' THEN 2
          ELSE 3
        END,
        a.queue_position ASC,
        datetime(a.scheduled_time) ASC
    `).all(queue.doctor_id);
  }

  /**
   * Retrieve queue events.
   */
  static getQueueEvents(queueId: number, limit = 15): QueueEvent[] {
    return db.prepare(`
      SELECT * FROM queue_events
      WHERE queue_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `).all(queueId, limit) as QueueEvent[];
  }
}
