import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/connection.js';
import { seedDatabase } from '../db/seed.js';
import { QueueService } from '../services/queue.service.js';
import { calculateAppointmentETA } from '../services/eta.service.js';

describe('Queue Lifecycle & State Transitions', () => {
  beforeEach(() => {
    seedDatabase(db);
  });

  it('calculates ETA with queue position and delay correctly for seeded demo patient', () => {
    // Appointment #3 is Demo Patient Rohan Mehta waiting at position #2
    const eta = calculateAppointmentETA(3);

    expect(eta).toBeDefined();
    expect(eta.patientsAhead).toBe(1); // Patient #2 is waiting at position 1 ahead of #3
    expect(eta.currentlyServingToken).toBe('GEN-101'); // Patient #1 is in consultation
    expect(eta.delayMinutes).toBe(5); // Seeded queue delay
    expect(eta.estimatedMinutes).toBeGreaterThan(0);
    expect(eta.rangeHigh).toBeGreaterThanOrEqual(eta.estimatedMinutes);
    expect(eta.rangeLow).toBeLessThanOrEqual(eta.estimatedMinutes);
  });

  it('advances queue when consultation starts and updates waiting positions', () => {
    // Current serving is #1. Complete it first:
    QueueService.completeConsultation(1, 8.5);

    // Now start consultation for next waiting patient (which was #2 Bhavna Patel)
    const newServing = QueueService.startNextConsultation(1);
    expect(newServing.token_number).toBe('GEN-102');
    expect(newServing.status).toBe('in_consultation');

    // Demo patient (#3) should now be at position #1 with 0 patients ahead!
    const updatedDemoAppt = db.prepare('SELECT * FROM appointments WHERE id = 3').get() as any;
    expect(updatedDemoAppt.queue_position).toBe(1);

    const eta = calculateAppointmentETA(3);
    expect(eta.patientsAhead).toBe(0);
    expect(eta.currentlyServingToken).toBe('GEN-102');
  });

  it('updating queue delay directly changes calculated waiting time', () => {
    const initialETA = calculateAppointmentETA(3).estimatedMinutes;

    // Add +15 min delay
    QueueService.setDelay(1, 15, 'Doctor called for emergency surgery');

    const delayedETA = calculateAppointmentETA(3).estimatedMinutes;
    // Initial delay was 5, new delay is 15 -> should increase by 10
    expect(delayedETA - initialETA).toBe(10);
  });

  it('recording consultation duration adds observation to history', () => {
    const countBefore = (db.prepare('SELECT COUNT(*) as c FROM consultation_history WHERE doctor_id = 1').get() as any).c;

    QueueService.completeConsultation(1, 12);

    const countAfter = (db.prepare('SELECT COUNT(*) as c FROM consultation_history WHERE doctor_id = 1').get() as any).c;
    expect(countAfter).toBe(countBefore + 1);

    const latest = db.prepare('SELECT * FROM consultation_history WHERE doctor_id = 1 ORDER BY id DESC LIMIT 1').get() as any;
    expect(latest.duration_minutes).toBe(12);
    expect(latest.source).toBe('simulated');
  });
});
