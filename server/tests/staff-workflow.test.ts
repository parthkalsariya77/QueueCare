import { describe, it, expect, beforeEach } from 'vitest';
import { QueueService } from '../services/queue.service.js';
import { HospitalService } from '../services/hospital.service.js';
import { getETAInsightsForQueue, calculateAppointmentETA } from '../services/eta.service.js';
import { db } from '../db/connection.js';
import { seedDatabase } from '../db/seed.js';

describe('Staff Multi-Hospital Queue Management & Real-Time Workflow Tests', () => {
  beforeEach(() => {
    seedDatabase(db);
  });

  it('Scenario 1: Hospital Overview partitions queues and facilities cleanly across the network', () => {
    // Hospital 1 (Zydus Super Specialty)
    const hosp1Queues = db.prepare(`
      SELECT q.id as queue_id, d.name as doctor_name, dept.name as department_name
      FROM queues q
      JOIN doctors d ON d.id = q.doctor_id
      JOIN departments dept ON dept.id = q.department_id
      WHERE q.hospital_id = 1
    `).all() as any[];

    // Hospital 2 (Apollo Clinic Gandhinagar)
    const hosp2Queues = db.prepare(`
      SELECT q.id as queue_id, d.name as doctor_name, dept.name as department_name
      FROM queues q
      JOIN doctors d ON d.id = q.doctor_id
      JOIN departments dept ON dept.id = q.department_id
      WHERE q.hospital_id = 2
    `).all() as any[];

    // Hospital 3 (Civil Hospital Medicity)
    const hosp3Queues = db.prepare(`
      SELECT q.id as queue_id, d.name as doctor_name, dept.name as department_name
      FROM queues q
      JOIN doctors d ON d.id = q.doctor_id
      JOIN departments dept ON dept.id = q.department_id
      WHERE q.hospital_id = 3
    `).all() as any[];

    // Hospital 4 (Shanti Community Health)
    const hosp4Queues = db.prepare(`
      SELECT q.id as queue_id, d.name as doctor_name, dept.name as department_name
      FROM queues q
      JOIN doctors d ON d.id = q.doctor_id
      JOIN departments dept ON dept.id = q.department_id
      WHERE q.hospital_id = 4
    `).all() as any[];

    expect(hosp1Queues.length).toBe(4);
    expect(hosp2Queues.length).toBe(3);
    expect(hosp3Queues.length).toBe(3);
    expect(hosp4Queues.length).toBe(3);

    const names1 = hosp1Queues.map(q => q.doctor_name);
    const names2 = hosp2Queues.map(q => q.doctor_name);
    const names3 = hosp3Queues.map(q => q.doctor_name);
    const names4 = hosp4Queues.map(q => q.doctor_name);

    expect(names1).toContain('Dr. Rajesh Patel');
    expect(names2).toContain('Dr. Priyanshi Dave');
    expect(names3).toContain('Dr. Snehal Vaghela');
    expect(names4).toContain('Dr. Chirag Bhatt');

    // Verify doctors are strictly isolated by hospital
    expect(names1).not.toContain('Dr. Priyanshi Dave');
    expect(names2).not.toContain('Dr. Rajesh Patel');
  });

  it('Scenario 2: Calling next patient in Hospital 2 (Apollo Pediatrics) transitions status and advances queue', () => {
    // Queue 5 = Dr. Priyanshi Dave (Pediatrics at Apollo Clinic)
    const initialEntries = QueueService.getQueueEntries(5);
    expect(initialEntries.length).toBeGreaterThan(0);

    const serving = initialEntries.find(e => e.status === 'in_consultation');
    expect(serving).toBeDefined();
    expect(serving.token_number).toBe('PED-201');

    const firstWaiting = initialEntries.find(e => e.status === 'waiting' && e.queue_position === 1);
    expect(firstWaiting).toBeDefined();
    expect(firstWaiting.token_number).toBe('PED-202');

    // Complete the current consultation first
    QueueService.completeConsultation(serving.id, 9);

    // Call first waiting patient into consultation
    const calledAppt = QueueService.startNextConsultation(5);
    expect(calledAppt.token_number).toBe('PED-202');
    expect(calledAppt.status).toBe('in_consultation');

    // Verify PED-203 is now #1 in line
    const updatedEntries = QueueService.getQueueEntries(5);
    const newServing = updatedEntries.find(e => e.status === 'in_consultation');
    expect(newServing?.token_number).toBe('PED-202');

    const promotedPatient = updatedEntries.find(e => e.token_number === 'PED-203');
    expect(promotedPatient?.queue_position).toBe(1);
  });

  it('Scenario 3: Completing consultation records duration and updates doctor EWMA pace', () => {
    // Complete current consultation in Queue 5
    const entries = QueueService.getQueueEntries(5);
    const inCons = entries.find(e => e.status === 'in_consultation')!;
    
    const beforeInsights = getETAInsightsForQueue(5);
    expect(beforeInsights).not.toBeNull();
    const beforeSamples = beforeInsights!.sampleCount;

    // Complete consultation with simulated 14 minute duration
    const completed = QueueService.completeConsultation(inCons.id, 14);
    expect(completed.status).toBe('completed');
    expect(completed.completed_at).toBeDefined();

    // Verify duration recorded in history
    const afterInsights = getETAInsightsForQueue(5);
    expect(afterInsights!.sampleCount).toBe(beforeSamples + 1);
    expect(afterInsights!.recentDurations).toContain(14);
  });

  it('Scenario 4: Setting operational delay affects only the target doctor queue', () => {
    // Queue 9 = Dr. Manish Joshi (ENT at Civil Hospital)
    // Queue 1 = Dr. Rajesh Patel (General Medicine at Zydus)
    const initialQ1 = db.prepare('SELECT delay_minutes FROM queues WHERE id = 1').get() as any;

    QueueService.setDelay(9, 20, 'Attending complex ear microsurgery review');

    const updatedQ9 = db.prepare('SELECT delay_minutes, delay_reason FROM queues WHERE id = 9').get() as any;
    expect(updatedQ9.delay_minutes).toBe(20);
    expect(updatedQ9.delay_reason).toContain('microsurgery');

    // Verify Queue 1 remains unchanged
    const currentQ1 = db.prepare('SELECT delay_minutes FROM queues WHERE id = 1').get() as any;
    expect(currentQ1.delay_minutes).toBe(initialQ1.delay_minutes);
  });

  it('Scenario 5: Pausing a queue updates status and reflects in patient ETA payload', () => {
    // Queue 3 = Dr. Vikramaditya Joshi (Cardiology at Zydus)
    QueueService.setStatus(3, 'paused', 'Doctor attending emergency cardiac arrest in ICU');

    const pausedQ3 = db.prepare('SELECT status, delay_reason FROM queues WHERE id = 3').get() as any;
    expect(pausedQ3.status).toBe('paused');

    // Get an appointment in this queue (Token CAR-301)
    const appt = db.prepare("SELECT id FROM appointments WHERE doctor_id = 3 AND status = 'waiting' LIMIT 1").get() as any;
    expect(appt).toBeDefined();

    const eta = calculateAppointmentETA(appt.id);
    expect(eta.isQueuePaused).toBe(true);
    expect(eta.delayReason).toContain('cardiac arrest');

    // Resume queue
    QueueService.setStatus(3, 'active');
    const activeQ3 = db.prepare('SELECT status FROM queues WHERE id = 3').get() as any;
    expect(activeQ3.status).toBe('active');

    const activeETA = calculateAppointmentETA(appt.id);
    expect(activeETA.isQueuePaused).toBe(false);
  });

  it('Scenario 6: Hospital search sorting by name returns alphabetical order with intact metadata', () => {
    const results = HospitalService.searchHospitals({ sortBy: 'name' });
    expect(results.length).toBeGreaterThan(1);

    // Verify alphabetical sorting
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].name.localeCompare(results[i + 1].name)).toBeLessThanOrEqual(0);
    }

    // Verify all required card metadata is preserved
    for (const h of results) {
      expect(h.name).toBeDefined();
      expect(h.locality).toBeDefined();
      expect(Array.isArray(h.departments)).toBe(true);
      expect(h.departments.length).toBeGreaterThan(0);
      expect(h.currentQueueWait).toBeGreaterThanOrEqual(5);
      expect(h.nextAvailableSlot).toBeDefined();
    }
  });

  it('Scenario 7: Marking no-show advances queue ahead and shortens estimated waiting time for following patients', () => {
    // Look up appointments waiting for doctor 1 (Dr. Rajesh Patel)
    const waitingAppts = db.prepare(`
      SELECT id, token_number FROM appointments 
      WHERE doctor_id = 1 AND status = 'waiting' 
      ORDER BY id ASC
    `).all() as any[];

    expect(waitingAppts.length).toBeGreaterThanOrEqual(2);

    const firstPatient = waitingAppts[0];
    const secondPatient = waitingAppts[1];

    const initialEtaSecond = calculateAppointmentETA(secondPatient.id);
    const initialAhead = initialEtaSecond.patientsAhead;
    const initialWait = initialEtaSecond.estimatedMinutes;

    // Staff marks first patient as no-show
    QueueService.markNoShow(firstPatient.id);

    // Re-calculate ETA for second patient
    const afterEtaSecond = calculateAppointmentETA(secondPatient.id);
    expect(afterEtaSecond.patientsAhead).toBe(initialAhead - 1);
    expect(afterEtaSecond.estimatedMinutes).toBeLessThan(initialWait);
  });
});
