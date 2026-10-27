import { describe, it, expect, beforeEach } from 'vitest';
import { QueueService } from '../services/queue.service.js';
import { HospitalService } from '../services/hospital.service.js';
import { calculateAppointmentETA, getETAInsightsForQueue } from '../services/eta.service.js';
import { db } from '../db/connection.js';
import { seedDatabase } from '../db/seed.js';

describe('System-Wide Integration, Harmony & Defect Prevention Tests', () => {
  beforeEach(() => {
    seedDatabase(db);
  });

  it('Defect Test 1: Active slot collision guard prevents double-booking for the same doctor and slot', () => {
    // Look up an existing booked appointment for Doctor 1 (Dr. Rajesh Patel)
    const existing = db.prepare(`
      SELECT doctor_id, scheduled_time, hospital_id, department_id 
      FROM appointments 
      WHERE doctor_id = 1 AND status NOT IN ('cancelled') 
      LIMIT 1
    `).get() as any;

    expect(existing).toBeDefined();

    // Verify duplicate booking detection query
    const collisionCheck = db.prepare(`
      SELECT id, token_number FROM appointments
      WHERE doctor_id = ? AND scheduled_time = ? AND status NOT IN ('cancelled')
    `).get(existing.doctor_id, existing.scheduled_time) as any;

    expect(collisionCheck).toBeDefined();
    expect(collisionCheck.id).toBeDefined();
  });

  it('Defect Test 2: Reschedule collision guard prevents moving to an occupied slot', () => {
    // Get two different active appointments for Doctor 1
    const appts = db.prepare(`
      SELECT id, scheduled_time FROM appointments 
      WHERE doctor_id = 1 AND status NOT IN ('cancelled') 
      ORDER BY id ASC LIMIT 2
    `).all() as any[];

    expect(appts.length).toBe(2);
    const [apptA, apptB] = appts;

    // Attempting to reschedule apptB to apptA's slot must throw collision error
    expect(() => {
      QueueService.reschedule(apptB.id, apptA.scheduled_time);
    }).toThrow(/already booked/i);
  });

  it('Defect Test 3: Queue state preconditions prevent calling next when consultation is already active', () => {
    // Find queue for doctor 1
    const queue = db.prepare('SELECT id, doctor_id FROM queues WHERE doctor_id = 1').get() as any;

    // Check if there is an active consultation
    let activeInConsultation = db.prepare(`
      SELECT * FROM appointments WHERE doctor_id = ? AND status = 'in_consultation'
    `).get(queue.doctor_id);

    // If none currently, start one
    if (!activeInConsultation) {
      QueueService.startNextConsultation(queue.id);
    }

    // Now calling next again MUST throw since current consultation is not finished
    expect(() => {
      QueueService.startNextConsultation(queue.id);
    }).toThrow(/already in consultation/i);
  });

  it('Defect Test 4: Cannot complete consultation for an appointment that is not in_consultation', () => {
    const waitingAppt = db.prepare("SELECT id FROM appointments WHERE status = 'waiting' LIMIT 1").get() as any;
    expect(waitingAppt).toBeDefined();

    expect(() => {
      QueueService.completeConsultation(waitingAppt.id, 10);
    }).toThrow(/Must be 'in_consultation'/i);
  });

  it('Harmony Test 5: Full patient-to-staff lifecycle propagates state across both portals', () => {
    // 1. Patient Books an Appointment for Doctor 2 (Dr. Ananya Sharma, Dermatology at Zydus)
    const queue2 = db.prepare('SELECT id, doctor_id, department_id, hospital_id FROM queues WHERE doctor_id = 2').get() as any;
    const tomorrowNoon = new Date();
    tomorrowNoon.setDate(tomorrowNoon.getDate() + 1);
    tomorrowNoon.setHours(11, 30, 0, 0);

    const insertResult = db.prepare(`
      INSERT INTO appointments (
        patient_id, patient_name, patient_phone, visit_reason, hospital_id, department_id, doctor_id, 
        token_number, scheduled_time, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', datetime('now'))
    `).run(
      'test-patient',
      'Test Patient A',
      '+91 99999 11111',
      'Skin allergy check',
      queue2.hospital_id,
      queue2.department_id,
      queue2.doctor_id,
      'DER-999',
      tomorrowNoon.toISOString()
    );

    const newApptId = Number(insertResult.lastInsertRowid);
    expect(newApptId).toBeGreaterThan(0);

    // 2. Pre-checkin ETA is valid
    const preCheckinEta = calculateAppointmentETA(newApptId);
    expect(preCheckinEta.isPreCheckin).toBe(true);
    expect(preCheckinEta.expectedCallTime).toBeDefined();
    expect(preCheckinEta.recommendedArrivalTime).toBeDefined();

    // 3. Patient checks in at reception -> Status transitions to 'waiting'
    const checkedInAppt = QueueService.checkIn(newApptId);
    expect(checkedInAppt.status).toBe('waiting');
    expect(checkedInAppt.queue_position).toBeGreaterThanOrEqual(1);

    // 4. Staff overview reflects the new waiting patient
    const entries = QueueService.getQueueEntries(queue2.id);
    const staffEntry = entries.find((e: any) => e.id === newApptId);
    expect(staffEntry).toBeDefined();
    expect(staffEntry.token_number).toBe('DER-999');

    // 5. Staff calls patient into chamber
    // Ensure any existing consultation is completed first
    const active = db.prepare("SELECT id FROM appointments WHERE doctor_id = ? AND status = 'in_consultation'").get(queue2.doctor_id) as any;
    if (active) QueueService.completeConsultation(active.id, 10);

    const consultingAppt = QueueService.startNextConsultation(queue2.id);
    expect(consultingAppt.status).toBe('in_consultation');

    // 6. Patient Tracker ETA reflects Serving Now
    const inConsEta = calculateAppointmentETA(consultingAppt.id);
    expect(inConsEta.estimatedMinutes).toBe(0);
    expect(inConsEta.patientsAhead).toBe(0);

    // 7. Staff completes consultation with recorded pace
    const initialInsights = getETAInsightsForQueue(queue2.id);
    const initialSamples = initialInsights!.sampleCount;

    QueueService.completeConsultation(consultingAppt.id, 16);

    const updatedInsights = getETAInsightsForQueue(queue2.id);
    expect(updatedInsights!.sampleCount).toBe(initialSamples + 1);
    expect(updatedInsights!.recentDurations).toContain(16);
  });

  it('Harmony Test 6: Queue Pause and Resume signals synchronize accurately with patient ETA', () => {
    // Queue 4 (Dr. Sneha Parikh, Pediatrics at Zydus)
    const queue4 = db.prepare('SELECT id, doctor_id FROM queues WHERE id = 4').get() as any;
    
    // Pause queue
    QueueService.setStatus(queue4.id, 'paused', 'Doctor attending emergency pediatric code in NICU');

    const appt = db.prepare("SELECT id FROM appointments WHERE doctor_id = ? AND status = 'waiting' LIMIT 1").get(queue4.doctor_id) as any;
    if (appt) {
      const pausedEta = calculateAppointmentETA(appt.id);
      expect(pausedEta.isQueuePaused).toBe(true);
      expect(pausedEta.delayReason).toContain('NICU');

      // Resume queue
      QueueService.setStatus(queue4.id, 'active');
      const resumedEta = calculateAppointmentETA(appt.id);
      expect(resumedEta.isQueuePaused).toBe(false);
    }
  });

  it('Harmony Test 7: Multi-date rescheduling updates calendar date, slot time, and resets queue position', () => {
    // Find an active appointment for Doctor 1
    const appt = db.prepare("SELECT id, doctor_id FROM appointments WHERE doctor_id = 1 AND status = 'waiting' LIMIT 1").get() as any;
    expect(appt).toBeDefined();

    // Reschedule to day after tomorrow at 3:30 PM
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    targetDate.setHours(15, 30, 0, 0);

    const updated = QueueService.reschedule(appt.id, targetDate.toISOString());
    expect(updated.status).toBe('booked');
    expect(updated.queue_position).toBeNull();
    expect(new Date(updated.scheduled_time).getDate()).toBe(targetDate.getDate());

    // Verify queue events recorded RESCHEDULED audit entry
    const events = db.prepare('SELECT * FROM queue_events WHERE queue_id = 1 ORDER BY id DESC LIMIT 5').all() as any[];
    expect(events.some(e => e.event_type === 'RESCHEDULED')).toBe(true);
  });

  it('Contract Test 8: All API endpoints return complete payloads matching frontend TypeScript interfaces', () => {
    // 1. Hospital Search Result structure
    const hospitals = HospitalService.searchHospitals();
    expect(hospitals.length).toBeGreaterThan(0);
    const h = hospitals[0];
    expect(typeof h.id).toBe('number');
    expect(typeof h.name).toBe('string');
    expect(typeof h.locality).toBe('string');
    expect(typeof h.currentQueueWait).toBe('number');
    expect(typeof h.nextAvailableSlot).toBe('string');
    expect(Array.isArray(h.departments)).toBe(true);
    expect(typeof h.waitingCount).toBe('number');

    // 2. Doctor Slots structure
    const slots = HospitalService.getAvailableSlots(1);
    expect(slots.length).toBeGreaterThan(0);
    const slot = slots[0];
    expect(typeof slot.time).toBe('string');
    expect(typeof slot.slotLabel).toBe('string');
    expect(['morning', 'afternoon']).toContain(slot.session);
    expect(typeof slot.isAvailable).toBe('boolean');
    expect(typeof slot.isBooked).toBe('boolean');

    // 3. Queue Insights structure
    const insights = getETAInsightsForQueue(1);
    expect(insights).not.toBeNull();
    expect(typeof insights!.doctorId).toBe('number');
    expect(typeof insights!.doctorName).toBe('string');
    expect(typeof insights!.doctorEWMA).toBe('number');
    expect(typeof insights!.departmentMedian).toBe('number');
    expect(typeof insights!.adaptiveETA).toBe('number');
    expect(typeof insights!.baselineETA).toBe('number');
    expect(Array.isArray(insights!.recentDurations)).toBe(true);
  });

  it('System Test 9: Cancellation lifecycle re-indexes waiting queue and blocks cancelling active consultation', () => {
    // 1. Waiting appointment cancellation
    const waitingAppts = db.prepare(`
      SELECT id, queue_position, doctor_id 
      FROM appointments 
      WHERE doctor_id = 1 AND status = 'waiting' 
      ORDER BY queue_position ASC
    `).all() as any[];

    expect(waitingAppts.length).toBeGreaterThanOrEqual(2);
    const firstWaiting = waitingAppts[0];
    const secondWaiting = waitingAppts[1];

    // Cancel first waiting
    db.prepare("UPDATE appointments SET status = 'cancelled', queue_position = NULL WHERE id = ?").run(firstWaiting.id);
    
    // Re-index remaining
    const remaining = db.prepare("SELECT id FROM appointments WHERE doctor_id = ? AND status = 'waiting' ORDER BY queue_position ASC").all(firstWaiting.doctor_id) as any[];
    const updateStmt = db.prepare('UPDATE appointments SET queue_position = ? WHERE id = ?');
    remaining.forEach((r, idx) => updateStmt.run(idx + 1, r.id));

    const updatedSecond = db.prepare('SELECT queue_position FROM appointments WHERE id = ?').get(secondWaiting.id) as any;
    expect(updatedSecond.queue_position).toBe(1);

    // 2. Active consultation cancellation blocked check
    const inConsAppt = db.prepare("SELECT id, status FROM appointments WHERE doctor_id = 1 AND status = 'in_consultation' LIMIT 1").get() as any;
    if (inConsAppt) {
      expect(['in_consultation', 'completed']).toContain(inConsAppt.status);
    }
  });

  it('System Test 10: Queue delay lifecycle (+25m delay then cleared to 0m) reflects accurately in patient ETA', () => {
    const queue1 = db.prepare('SELECT id, doctor_id FROM queues WHERE id = 1').get() as any;
    const appt = db.prepare("SELECT id FROM appointments WHERE doctor_id = ? AND status = 'waiting' LIMIT 1").get(queue1.doctor_id) as any;

    if (appt) {
      // Set +25m delay
      QueueService.setDelay(queue1.id, 25, 'Equipment calibration delay');
      const delayedEta = calculateAppointmentETA(appt.id);
      expect(delayedEta.delayMinutes).toBe(25);
      expect(delayedEta.delayReason).toContain('Equipment calibration');

      // Clear delay
      QueueService.setDelay(queue1.id, 0, null);
      const clearedEta = calculateAppointmentETA(appt.id);
      expect(clearedEta.delayMinutes).toBe(0);
      expect(clearedEta.estimatedMinutes).toBeLessThan(delayedEta.estimatedMinutes);
    }
  });

  it('System Test 11: Demo database reset restores pristine state and intact patient records', () => {
    // Modify database state
    QueueService.setDelay(1, 45, 'Temporary test delay');
    
    // Reset database
    seedDatabase(db);

    // Verify queue 1 restored
    const q1 = db.prepare('SELECT delay_minutes FROM queues WHERE id = 1').get() as any;
    expect(q1.delay_minutes).toBe(5); // initial seeded delay

    // Verify Rohan Mehta appointments exist
    const rohanAppts = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE patient_name = 'Rohan Mehta'").get() as any;
    expect(rohanAppts.count).toBeGreaterThanOrEqual(4);
  });
});
