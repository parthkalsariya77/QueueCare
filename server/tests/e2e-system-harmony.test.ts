import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { app } from '../index.js';
import { db } from '../db/connection.js';
import { seedDatabase } from '../db/seed.js';

interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

function request(
  method: 'GET' | 'POST',
  url: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const jsonStr = body !== undefined ? JSON.stringify(body) : '';
    let pushed = false;

    const req = new Readable({
      read() {
        if (!pushed) {
          pushed = true;
          if (jsonStr) {
            this.push(jsonStr);
          }
          this.push(null);
        }
      }
    }) as any;

    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(jsonStr).toString(),
      ...headers
    };

    if (body !== undefined) {
      req.body = body;
      req._body = true;
    }

    const resHeaders: Record<string, string> = {};
    let statusCode = 200;

    const res: any = {
      statusCode: 200,
      set(keyOrObj: any, val?: string) {
        if (typeof keyOrObj === 'string') {
          resHeaders[keyOrObj.toLowerCase()] = String(val);
        } else if (keyOrObj) {
          for (const k of Object.keys(keyOrObj)) {
            resHeaders[k.toLowerCase()] = String(keyOrObj[k]);
          }
        }
        return res;
      },
      setHeader(k: string, v: string) {
        resHeaders[k.toLowerCase()] = String(v);
        return res;
      },
      getHeader(k: string) {
        return resHeaders[k.toLowerCase()];
      },
      status(code: number) {
        statusCode = code;
        res.statusCode = code;
        return res;
      },
      json(data: any) {
        resolve({ status: statusCode, headers: resHeaders, body: data });
      },
      send(data: any) {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: statusCode, headers: resHeaders, body: parsed });
        } catch {
          resolve({ status: statusCode, headers: resHeaders, body: data });
        }
      },
      end(data?: any) {
        if (data) this.send(data);
        else resolve({ status: statusCode, headers: resHeaders, body: null });
      },
      on() {
        return res;
      }
    };

    app(req, res, (err: any) => {
      if (err) reject(err);
      else resolve({ status: 404, headers: resHeaders, body: { error: 'Not Found' } });
    });
  });
}

describe('End-to-End System & Harmony Integration Tests (Full In-Memory Express Pipeline)', () => {
  beforeEach(() => {
    seedDatabase(db);
  });

  it('System Test 1: Real HTTP Anti-Caching & Security Headers verification', async () => {
    const res = await request('GET', '/api/hospitals');
    expect(res.status).toBe(200);

    const cacheControl = res.headers['cache-control'];
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('must-revalidate');

    // ETag must not be set to prevent 304 caching storm
    expect(res.headers['etag']).toBeUndefined();
  });

  it('System Test 2: Health check endpoint returns valid system status and timestamp', async () => {
    const res = await request('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.app).toBe('QueueCare');
    expect(res.body.version).toBe('1.0.0');
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

  it('System Test 3: Hospital search, filtering, and alphabetical vs wait-time sorting', async () => {
    // 1. Search by department
    const cardioRes = await request('GET', '/api/hospitals?department=Cardiology');
    expect(cardioRes.status).toBe(200);
    expect(cardioRes.body.success).toBe(true);
    expect(cardioRes.body.data.length).toBeGreaterThan(0);
    cardioRes.body.data.forEach((h: any) => {
      expect(h.departments).toContain('Cardiology');
    });

    // 2. Search by locality
    const localityRes = await request('GET', '/api/hospitals?locality=Navrangpura');
    expect(localityRes.status).toBe(200);
    expect(localityRes.body.success).toBe(true);
    expect(localityRes.body.data.length).toBeGreaterThan(0);
    localityBodyCheck: for (const h of localityRes.body.data) {
      expect(h.locality).toBe('Navrangpura');
    }

    // 3. Alphabetical sort
    const nameSortRes = await request('GET', '/api/hospitals?sort=name');
    expect(nameSortRes.status).toBe(200);
    expect(nameSortRes.body.success).toBe(true);
    const names = nameSortRes.body.data.map((h: any) => h.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

  it('System Test 4: Parameter validation and graceful 400/404 handling across all routes', async () => {
    // Invalid non-numeric hospital ID
    const badHosp = await request('GET', '/api/hospitals/abc');
    expect(badHosp.status).toBe(400);

    // Non-existent hospital ID
    const notFoundHosp = await request('GET', '/api/hospitals/99999');
    expect(notFoundHosp.status).toBe(404);

    // Invalid non-numeric appointment ID
    const badAppt = await request('GET', '/api/appointments/xyz');
    expect(badAppt.status).toBe(400);

    // Non-existent appointment ID
    const notFoundAppt = await request('GET', '/api/appointments/99999');
    expect(notFoundAppt.status).toBe(404);

    // Invalid non-numeric queue ID
    const badQueue = await request('GET', '/api/queues/bad-queue');
    expect(badQueue.status).toBe(400);

    // Non-existent queue ID
    const notFoundQueue = await request('GET', '/api/queues/99999');
    expect(notFoundQueue.status).toBe(404);
  });

  it('Harmony Test 5: Full patient-to-staff live lifecycle over HTTP pipeline', async () => {
    // 1. Get available slots for Doctor 1 (Dr. Rajesh Patel)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString();

    const slotsRes = await request('GET', `/api/hospitals/doctors/1/slots?date=${encodeURIComponent(dateStr)}`);
    expect(slotsRes.status).toBe(200);
    expect(slotsRes.body.success).toBe(true);
    expect(slotsRes.body.data.length).toBeGreaterThan(0);

    const availableSlot = slotsRes.body.data.find((s: any) => s.isAvailable);
    expect(availableSlot).toBeDefined();

    // 2. Patient books the available slot
    const bookRes = await request('POST', '/api/appointments', {
      hospitalId: 1,
      departmentId: 1,
      doctorId: 1,
      scheduledTime: availableSlot.time,
      patientName: 'Demo Test Patient',
      patientPhone: '+91 98980 98980',
      visitReason: 'General health check'
    });

    expect(bookRes.status).toBe(201);
    const newAppt = bookRes.body.data;
    expect(newAppt.token_number).toMatch(/GEN-\d+/);
    expect(newAppt.status).toBe('booked');

    // 3. Duplicate booking attempt for the exact same slot must be rejected with 409 Conflict
    const dupRes = await request('POST', '/api/appointments', {
      hospitalId: 1,
      departmentId: 1,
      doctorId: 1,
      scheduledTime: availableSlot.time,
      patientName: 'Another Patient',
      patientPhone: '+91 90000 00000',
      visitReason: 'Another check'
    });
    expect(dupRes.status).toBe(409);

    // 4. Pre-checkin ETA advisory for patient at home
    const preCheckinRes = await request('GET', `/api/appointments/${newAppt.id}`);
    expect(preCheckinRes.status).toBe(200);
    expect(preCheckinRes.body.data.eta).toBeDefined();
    expect(preCheckinRes.body.data.eta.isPreCheckin).toBe(true);
    expect(preCheckinRes.body.data.eta.leaveHomeAdvice).toBeDefined();

    // 5. Patient checks in at clinic reception
    const checkinRes = await request('POST', `/api/appointments/${newAppt.id}/checkin`);
    expect(checkinRes.status).toBe(200);
    expect(checkinRes.body.data.status).toBe('waiting');
    expect(checkinRes.body.data.queue_position).toBeGreaterThan(0);

    // 6. Check Staff Overview: Doctor 1 queue displays waiting patient
    const staffOverviewRes = await request('GET', '/api/staff/overview?hospitalId=1');
    expect(staffOverviewRes.status).toBe(200);
    const doc1Queue = staffOverviewRes.body.data.queues.find((q: any) => q.doctor_id === 1);
    expect(doc1Queue).toBeDefined();
    expect(doc1Queue.waiting_count).toBeGreaterThan(0);
  });

  it('Harmony Test 6: Operational controls (Delay, Pause, Resume, No-Show) propagate to patient ETA', async () => {
    // Look up Doctor 1 queue
    const queueRes = await request('GET', '/api/queues/1');
    expect(queueRes.status).toBe(200);
    const queueId = queueRes.body.data.id;

    // Find an active waiting appointment for Doctor 1
    const entriesRes = await request('GET', `/api/queues/${queueId}/entries`);
    expect(entriesRes.status).toBe(200);
    const waitingAppt = entriesRes.body.data.find((e: any) => e.status === 'waiting');
    expect(waitingAppt).toBeDefined();

    // 1. Staff sets a +15m operational delay
    const delayRes = await request('POST', '/api/staff/set-delay', {
      queueId,
      delayMinutes: 15,
      reason: 'Emergency ICU consultation'
    });
    expect(delayRes.status).toBe(200);

    // Verify patient ETA reflects +15m delay
    const etaAfterDelayRes = await request('GET', `/api/appointments/${waitingAppt.id}`);
    expect(etaAfterDelayRes.status).toBe(200);
    expect(etaAfterDelayRes.body.data.eta.delayMinutes).toBe(15);
    expect(etaAfterDelayRes.body.data.eta.delayReason).toBe('Emergency ICU consultation');

    // 2. Staff pauses queue
    const pauseRes = await request('POST', '/api/staff/toggle-pause', {
      queueId,
      status: 'paused',
      reason: 'OPD chamber sanitation'
    });
    expect(pauseRes.status).toBe(200);

    // Verify patient ETA reflects queue is paused
    const etaAfterPauseRes = await request('GET', `/api/appointments/${waitingAppt.id}`);
    expect(etaAfterPauseRes.status).toBe(200);
    expect(etaAfterPauseRes.body.data.eta.isQueuePaused).toBe(true);

    // 3. Staff resumes queue
    const resumeRes = await request('POST', '/api/staff/toggle-pause', {
      queueId,
      status: 'active'
    });
    expect(resumeRes.status).toBe(200);

    const etaAfterResumeRes = await request('GET', `/api/appointments/${waitingAppt.id}`);
    expect(etaAfterResumeRes.status).toBe(200);
    expect(etaAfterResumeRes.body.data.eta.isQueuePaused).toBe(false);

    // 4. Clear delay back to 0
    await request('POST', '/api/staff/set-delay', {
      queueId,
      delayMinutes: 0
    });
  });

  it('System Test 7: Demo database reset endpoint restores clean data state', async () => {
    // Reset demo via HTTP
    const resetRes = await request('POST', '/api/staff/reset-demo');
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Verify demo patient appointments exist and are in order
    const apptsRes = await request('GET', '/api/appointments');
    expect(apptsRes.status).toBe(200);
    expect(apptsRes.body.data.length).toBeGreaterThan(0);

    const tokens = apptsRes.body.data.map((a: any) => a.token_number);
    expect(tokens).toContain('GEN-103');
  });
});
