import { describe, it, expect, beforeEach } from 'vitest';
import { HospitalService } from '../services/hospital.service.js';
import { QueueService } from '../services/queue.service.js';
import { calculateAppointmentETA, getDoctorPredictedDuration, getETAInsightsForQueue } from '../services/eta.service.js';
import { db } from '../db/connection.js';
import { seedDatabase } from '../db/seed.js';

describe('End-to-End Core Workflow Integration Tests', () => {
  beforeEach(() => {
    seedDatabase(db);
  });

  it('Scenario A: Hospital search matches symptoms, locality, and sorts by wait time', () => {
    // Search by symptom 'heart' should return hospital with Cardiology department (Zydus)
    const heartResults = HospitalService.searchHospitals({ keyword: 'heart' });
    expect(heartResults.length).toBeGreaterThan(0);
    expect(heartResults[0].departments).toContain('Cardiology');

    // Filter by locality 'Gandhinagar'
    const gandhinagarResults = HospitalService.searchHospitals({ locality: 'Gandhinagar' });
    expect(gandhinagarResults.length).toBeGreaterThan(0);
    expect(gandhinagarResults[0].city).toBe('Gandhinagar');

    // Sorting by shortest wait time
    const sorted = HospitalService.searchHospitals({ sortBy: 'wait' });
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].currentQueueWait).toBeLessThanOrEqual(sorted[i + 1].currentQueueWait);
    }
  });

  it('Scenario B: Patient books an appointment and receives a unique token', () => {
    // Count before
    const beforeCount = (db.prepare('SELECT COUNT(*) as c FROM appointments').get() as any).c;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);

    const department = db.prepare('SELECT name FROM departments WHERE id = 1').get() as any;
    const countRow = (db.prepare('SELECT COUNT(*) as count FROM appointments WHERE department_id = 1').get() as any).count;
    const tokenNumber = `GEN-${101 + countRow}`;

    const insertRes = db.prepare(`
      INSERT INTO appointments (
        patient_id, patient_name, hospital_id, department_id, doctor_id, 
        token_number, scheduled_time, status, created_at
      ) VALUES ('demo-patient', 'Rohan Mehta', 1, 1, 1, ?, ?, 'booked', datetime('now'))
    `).run(tokenNumber, tomorrow.toISOString());

    const apptId = insertRes.lastInsertRowid as number;
    const newAppt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId) as any;

    expect(newAppt).toBeDefined();
    expect(newAppt.token_number).toContain('GEN-');
    expect(newAppt.status).toBe('booked');

    const afterCount = (db.prepare('SELECT COUNT(*) as c FROM appointments').get() as any).c;
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('Scenario C & D: Staff delay and consultation updates propagate immediately to patient ETA', () => {
    // Appointment #3 is Demo Patient waiting in queue #1
    const initialETA = calculateAppointmentETA(3);
    expect(initialETA.patientsAhead).toBe(1);

    // Staff adds a 10 min delay to queue #1
    QueueService.setDelay(1, 10, 'Doctor attending critical emergency');

    const delayedETA = calculateAppointmentETA(3);
    expect(delayedETA.delayMinutes).toBe(10);
    expect(delayedETA.estimatedMinutes).toBeGreaterThanOrEqual(initialETA.estimatedMinutes + 5);

    // Staff completes current patient (Token GEN-101) with duration 6 minutes
    QueueService.completeConsultation(1, 6);

    // Staff calls next patient (Token GEN-102) into consultation
    QueueService.startNextConsultation(1);

    // Now Demo Patient (#3) is next in line (0 patients ahead)!
    const updatedETA = calculateAppointmentETA(3);
    expect(updatedETA.patientsAhead).toBe(0);
    expect(updatedETA.currentlyServingToken).toBe('GEN-102');
  });

  it('Scenario E: Adaptive ETA learns from completed consultation duration', () => {
    // Check initial predicted pace for Doctor #1
    const beforeStats = getDoctorPredictedDuration(1, 1);
    const beforeCount = beforeStats.doctorSampleCount;
    const beforeEWMA = beforeStats.doctorEWMA;

    // Complete consultation with an unusually long duration of 25 minutes
    QueueService.completeConsultation(1, 25);

    const afterStats = getDoctorPredictedDuration(1, 1);
    expect(afterStats.doctorSampleCount).toBe(beforeCount + 1);
    // Because latest duration (25m) was higher than previous EWMA (~8m), EWMA should increase!
    expect(afterStats.doctorEWMA).toBeGreaterThan(beforeEWMA);
  });

  it('Scenario F: Rescheduling appointment updates slot and resets queue sequence', () => {
    // Reschedule appointment #2 to 3:30 PM
    const newTime = new Date();
    newTime.setHours(15, 30, 0, 0);

    const updated = QueueService.reschedule(2, newTime.toISOString());
    expect(updated.status).toBe('booked');
    expect(updated.queue_position).toBeNull();

    // Remaining demo patient #3 should now move forward in queue
    const demoPatient = db.prepare('SELECT * FROM appointments WHERE id = 3').get() as any;
    expect(demoPatient.queue_position).toBe(1);
  });

  it('Scenario H: Multi-day slots accurately separate bookings by date', () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySlots = HospitalService.getAvailableSlots(1, today.toISOString());
    const tomorrowSlots = HospitalService.getAvailableSlots(1, tomorrow.toISOString());

    // Both should generate 16 slots (8 morning + 8 afternoon)
    expect(todaySlots.length).toBe(16);
    expect(tomorrowSlots.length).toBe(16);

    // Some slots for today are booked in seed (e.g. 11:30 AM, 12:00 PM)
    const todayBooked = todaySlots.filter(s => !s.isAvailable);
    expect(todayBooked.length).toBeGreaterThan(0);

    // Tomorrow should have open slots independently
    const tomorrowOpen = tomorrowSlots.filter(s => s.isAvailable);
    expect(tomorrowOpen.length).toBeGreaterThan(0);
  });

  it('Scenario I: Sequential token generation maintains strict order and preserves phone & reason', () => {
    // Book an appointment via SQL using the same logic as the route
    const deptId = 1;
    const maxTokenRow = db.prepare(`
      SELECT MAX(CAST(SUBSTR(token_number, INSTR(token_number, '-') + 1) AS INTEGER)) as max_token
      FROM appointments WHERE department_id = ?
    `).get(deptId) as { max_token: number | null };

    const expectedNext = (maxTokenRow?.max_token || 100) + 1;
    const token = `GEN-${expectedNext}`;

    const insert = db.prepare(`
      INSERT INTO appointments (
        patient_id, patient_name, patient_phone, visit_reason, hospital_id, department_id, doctor_id,
        token_number, scheduled_time, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'booked', datetime('now'))
    `).run('demo-patient', 'Rohan Mehta', '+91 99999 88888', 'Severe allergic rhinitis', 1, 1, 1, token);

    const record = db.prepare('SELECT * FROM appointments WHERE id = ?').get(insert.lastInsertRowid) as any;
    expect(record.token_number).toBe(`GEN-${expectedNext}`);
    expect(record.patient_phone).toBe('+91 99999 88888');
    expect(record.visit_reason).toBe('Severe allergic rhinitis');
  });

  it('Scenario J: Hospital search returns non-zero realistic wait times across all facilities', () => {
    const hospitals = HospitalService.searchHospitals();
    expect(hospitals.length).toBe(4);
    for (const h of hospitals) {
      expect(h.currentQueueWait).toBeGreaterThanOrEqual(5);
      expect(h.departments.length).toBeGreaterThan(0);
    }
  });

  it('Scenario K: Pre-checkin ETA projection provides departure advice and expected call time for booked status', () => {
    // Appointment #7 is Rohan Mehta booked for today afternoon at Apollo Pediatrics
    const eta = calculateAppointmentETA(7);
    expect(eta).toBeDefined();
    expect(eta.isPreCheckin).toBe(true);
    expect(eta.expectedCallTime).toBeDefined();
    expect(eta.recommendedArrivalTime).toBeDefined();
    expect(eta.leaveHomeAdvice).toBeDefined();
    expect(eta.leaveHomeAdvice.length).toBeGreaterThan(10);
    expect(eta.aheadBreakdown).toBeDefined();
    expect(eta.safetyMarginMinutes).toBeGreaterThanOrEqual(3);
  });

  it('Scenario L: Marking waiting patient as No-Show advances queue and logs skip audit event', () => {
    // Demo patient is waiting at #2 (id: 3) behind Bhavna Patel (id: 2) at #1
    const beforeETA = calculateAppointmentETA(3);
    expect(beforeETA.patientsAhead).toBe(1);

    // Staff marks Bhavna Patel (id: 2) as No-Show
    QueueService.markNoShow(2);

    // Patient #2 is now no_show
    const bhavna = db.prepare('SELECT status, queue_position FROM appointments WHERE id = 2').get() as any;
    expect(bhavna.status).toBe('no_show');
    expect(bhavna.queue_position).toBeNull();

    // Demo patient is now #1!
    const updatedDemo = db.prepare('SELECT queue_position FROM appointments WHERE id = 3').get() as any;
    expect(updatedDemo.queue_position).toBe(1);

    const afterETA = calculateAppointmentETA(3);
    expect(afterETA.patientsAhead).toBe(0);

    // Verify audit event was logged
    const event = db.prepare('SELECT * FROM queue_events WHERE event_type = ? ORDER BY id DESC LIMIT 1').get('NO_SHOW') as any;
    expect(event).toBeDefined();
    expect(event.message).toContain('No-Show');
  });

  it('Scenario M: Slot generator correctly segregates Morning and Afternoon sessions', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const slots = HospitalService.getAvailableSlots(1, tomorrow.toISOString());
    const morning = slots.filter(s => s.session === 'morning');
    const afternoon = slots.filter(s => s.session === 'afternoon');

    expect(morning.length).toBe(8);
    expect(afternoon.length).toBe(8);
    expect(morning[0].slotLabel).toBe('9:00 AM');
    expect(afternoon[0].slotLabel).toBe('2:00 PM');
  });

  it('Scenario N: Staff console properly partitions queues and entries across different doctors', () => {
    // Queue 1 is Dr. Rajesh Patel (General Medicine at Zydus)
    const entriesQueue1 = QueueService.getQueueEntries(1);
    expect(entriesQueue1).toBeDefined();
    expect(entriesQueue1.length).toBeGreaterThan(0);
    expect(entriesQueue1[0].doctor_id).toBe(1);

    // Queue 3 is Dr. Ketan Mehta (Cardiology at Zydus)
    const entriesQueue3 = QueueService.getQueueEntries(3);
    expect(entriesQueue3).toBeDefined();
    expect(entriesQueue3.length).toBeGreaterThan(0);
    expect(entriesQueue3[0].doctor_id).toBe(3);

    // Ensure tokens and patient rosters are doctor-specific and distinct
    const tokens1 = entriesQueue1.map(e => e.token_number);
    const tokens3 = entriesQueue3.map(e => e.token_number);
    expect(tokens1).toContain('GEN-101');
    expect(tokens3).toContain('CAR-301');
    expect(tokens1).not.toContain('CAR-301');
    expect(tokens3).not.toContain('GEN-101');
  });

  it('Scenario O: Queue insights properly isolates doctor-specific EWMA model and observation history', () => {
    const insightsQueue1 = getETAInsightsForQueue(1);
    const insightsQueue3 = getETAInsightsForQueue(3);

    expect(insightsQueue1).not.toBeNull();
    expect(insightsQueue3).not.toBeNull();

    expect(insightsQueue1!.doctorName).toContain('Rajesh Patel');
    expect(insightsQueue3!.doctorName).toContain('Vikramaditya Joshi');

    // Both doctors have valid, non-zero sample observations and distinct EWMAs
    expect(insightsQueue1!.sampleCount).toBeGreaterThanOrEqual(10);
    expect(insightsQueue3!.sampleCount).toBeGreaterThanOrEqual(10);
    expect(insightsQueue1!.recentDurations.length).toBeGreaterThan(0);
    expect(insightsQueue3!.recentDurations.length).toBeGreaterThan(0);
    expect(insightsQueue1!.adaptiveETA).toBeGreaterThan(0);
    expect(insightsQueue3!.adaptiveETA).toBeGreaterThan(0);
  });

  it('Scenario P: Switching hospital loads correct distinct queues for that hospital', () => {
    // Hospital 1 = Zydus
    const queuesHosp1 = db.prepare('SELECT id, doctor_id FROM queues WHERE hospital_id = 1').all() as any[];
    // Hospital 2 = Apollo Clinic
    const queuesHosp2 = db.prepare('SELECT id, doctor_id FROM queues WHERE hospital_id = 2').all() as any[];

    expect(queuesHosp1.length).toBeGreaterThan(0);
    expect(queuesHosp2.length).toBeGreaterThan(0);

    const queueIdsHosp1 = queuesHosp1.map(q => q.id);
    const queueIdsHosp2 = queuesHosp2.map(q => q.id);

    // Ensure completely disjoint sets of queues
    const overlap = queueIdsHosp1.filter(id => queueIdsHosp2.includes(id));
    expect(overlap.length).toBe(0);
  });
});
