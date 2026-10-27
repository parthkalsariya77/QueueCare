import { db } from '../db/connection.js';
import { HospitalSearchResult, TimeSlot } from '../../shared/types.js';
import { getDoctorPredictedDuration } from './eta.service.js';

export interface HospitalFilterParams {
  keyword?: string;
  department?: string;
  locality?: string;
  openOnly?: boolean;
  maxWait?: number;
  sortBy?: 'wait' | 'earliest' | 'name';
}

export class HospitalService {
  /**
   * Search and filter hospitals with live queue estimates.
   */
  static searchHospitals(params: HospitalFilterParams = {}): HospitalSearchResult[] {
    const { keyword, department, locality, openOnly, maxWait, sortBy = 'wait' } = params;

    // Fetch all hospitals
    let query = `SELECT * FROM hospitals WHERE 1=1`;
    const sqlParams: any[] = [];

    if (openOnly) {
      query += ` AND is_open = 1`;
    }

    if (locality && locality !== 'all') {
      query += ` AND (locality LIKE ? OR city LIKE ?)`;
      sqlParams.push(`%${locality}%`, `%${locality}%`);
    }

    const hospitals = db.prepare(query).all(...sqlParams) as any[];

    // Process each hospital to attach departments and calculate live queue wait
    const results: HospitalSearchResult[] = hospitals.map(h => {
      // Get departments for this hospital
      const deptRows = db.prepare(`
        SELECT name FROM departments WHERE hospital_id = ?
      `).all(h.id) as { name: string }[];
      const departments = deptRows.map(d => d.name);

      // Get doctors for this hospital
      const doctorRows = db.prepare(`
        SELECT id, name, department_id FROM doctors WHERE hospital_id = ?
      `).all(h.id) as { id: number; name: string; department_id: number }[];

      // Filter doctors if a specific department is requested
      let relevantDoctors = doctorRows;
      if (department && department !== 'all') {
        const targetDept = db.prepare(`
          SELECT id FROM departments WHERE hospital_id = ? AND LOWER(name) = LOWER(?)
        `).get(h.id, department) as { id: number } | undefined;
        if (targetDept) {
          relevantDoctors = doctorRows.filter(d => d.department_id === targetDept.id);
        }
      }

      let totalWaiting = 0;
      const activeQueueWaits: number[] = [];

      for (const doc of doctorRows) {
        const queue = db.prepare(`
          SELECT status, delay_minutes FROM queues WHERE doctor_id = ?
        `).get(doc.id) as { status: string; delay_minutes: number } | undefined;

        const waitingCountRow = db.prepare(`
          SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = 'waiting'
        `).get(doc.id) as { count: number };

        const inConsCountRow = db.prepare(`
          SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = 'in_consultation'
        `).get(doc.id) as { count: number };

        const waiting = waitingCountRow.count;
        totalWaiting += waiting;

        const isRelevant = relevantDoctors.some(d => d.id === doc.id);
        if (isRelevant && queue && queue.status === 'active') {
          const stats = getDoctorPredictedDuration(doc.id, doc.department_id);
          const activePatients = waiting + inConsCountRow.count;
          if (activePatients > 0 || (queue.delay_minutes || 0) > 0) {
            const queueWait = Math.round(activePatients * stats.predictedDuration + (queue.delay_minutes || 0));
            activeQueueWaits.push(queueWait);
          }
        }
      }

      // Calculate representative wait:
      // If there are active queues, take the average of active queues.
      // If no patients are waiting in the hospital right now, baseline walk-in wait is 5-8 mins (triage/intake).
      let currentQueueWait = 8;
      if (activeQueueWaits.length > 0) {
        currentQueueWait = Math.round(activeQueueWaits.reduce((a, b) => a + b, 0) / activeQueueWaits.length);
      } else if (totalWaiting > 0) {
        currentQueueWait = 15;
      }

      // Realistic next available appointment slot display
      const now = new Date();
      const nextHour = (now.getHours() + 1) % 24;
      const displayHour = nextHour > 12 ? nextHour - 12 : (nextHour === 0 ? 12 : nextHour);
      const ampm = nextHour >= 12 ? 'PM' : 'AM';
      const nextAvailableSlot = `Today, ${displayHour}:30 ${ampm}`;

      return {
        ...h,
        departments,
        currentQueueWait: Math.max(5, currentQueueWait),
        nextAvailableSlot,
        waitingCount: totalWaiting,
        activeDoctorsCount: doctorRows.length
      };
    });

    // Filter in-memory for keyword (matching hospital name, locality, department, or common symptoms)
    let filtered = results;

    if (keyword && keyword.trim().length > 0) {
      const q = keyword.toLowerCase().trim();
      
      // Symptom mapping to departments
      const symptomDeptMap: Record<string, string[]> = {
        'fever': ['General Medicine', 'Pediatrics'],
        'cold': ['General Medicine', 'ENT & Head-Neck'],
        'cough': ['General Medicine', 'ENT & Head-Neck', 'Pediatrics'],
        'heart': ['Cardiology'],
        'chest': ['Cardiology', 'General Medicine'],
        'bp': ['Cardiology', 'General Medicine'],
        'bone': ['Orthopedics'],
        'fracture': ['Orthopedics'],
        'joint': ['Orthopedics'],
        'skin': ['Dermatology'],
        'rash': ['Dermatology'],
        'ear': ['ENT & Head-Neck'],
        'eye': ['Ophthalmology'],
        'child': ['Pediatrics'],
        'baby': ['Pediatrics'],
        'pregnancy': ['Gynecology'],
        'women': ['Gynecology']
      };

      let mappedDepts: string[] = [];
      for (const [sym, depts] of Object.entries(symptomDeptMap)) {
        const regex = new RegExp(`\\b${sym}\\b`, 'i');
        if (regex.test(q) || q === sym) {
          mappedDepts = mappedDepts.concat(depts);
        }
      }

      filtered = filtered.filter(h => {
        const matchesName = h.name.toLowerCase().includes(q);
        const matchesLocality = h.locality.toLowerCase().includes(q);
        const matchesDesc = (h.description || '').toLowerCase().includes(q);
        const matchesDept = h.departments.some(d => d.toLowerCase().includes(q));
        const matchesSymptom = mappedDepts.length > 0 && h.departments.some(d => mappedDepts.includes(d));

        // Check if any doctor in this hospital matches the doctor name
        const docMatch = db.prepare(`
          SELECT COUNT(*) as count FROM doctors 
          WHERE hospital_id = ? AND LOWER(name) LIKE ?
        `).get(h.id, `%${q}%`) as { count: number };

        return matchesName || matchesLocality || matchesDesc || matchesDept || matchesSymptom || docMatch.count > 0;
      });
    }

    if (department && department !== 'all') {
      filtered = filtered.filter(h => 
        h.departments.some(d => d.toLowerCase() === department.toLowerCase())
      );
    }

    if (maxWait && maxWait > 0) {
      filtered = filtered.filter(h => h.currentQueueWait <= maxWait);
    }

    // Sort results
    if (sortBy === 'wait') {
      filtered.sort((a, b) => (a.currentQueueWait || 0) - (b.currentQueueWait || 0));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return filtered;
  }

  /**
   * Get full hospital details with departments, doctors, and real-time doctor queue stats.
   */
  static getHospitalDetail(hospitalId: number): any {
    const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospitalId) as any;
    if (!hospital) return null;

    const departments = db.prepare(`
      SELECT * FROM departments WHERE hospital_id = ?
    `).all(hospitalId) as any[];

    const departmentsWithDoctors = departments.map(dept => {
      const doctors = db.prepare(`
        SELECT d.*, q.id as queue_id, q.status as queue_status, q.delay_minutes, q.delay_reason
        FROM doctors d
        LEFT JOIN queues q ON q.doctor_id = d.id
        WHERE d.department_id = ?
      `).all(dept.id) as any[];

      const doctorsWithStats = doctors.map(doc => {
        const waitingRow = db.prepare(`
          SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = 'waiting'
        `).get(doc.id) as { count: number };

        const inConsRow = db.prepare(`
          SELECT token_number FROM appointments WHERE doctor_id = ? AND status = 'in_consultation' LIMIT 1
        `).get(doc.id) as { token_number: string } | undefined;

        const stats = getDoctorPredictedDuration(doc.id, dept.id);
        const inConsCount = inConsRow ? 1 : 0;
        const currentWait = Math.round((waitingRow.count + inConsCount) * stats.predictedDuration + (doc.delay_minutes || 0));

        return {
          ...doc,
          waitingCount: waitingRow.count,
          currentlyServingToken: inConsRow ? inConsRow.token_number : null,
          currentWaitMinutes: currentWait,
          predictedAvgMinutes: stats.predictedDuration,
          sampleCount: stats.doctorSampleCount
        };
      });

      return {
        ...dept,
        doctors: doctorsWithStats
      };
    });

    return {
      ...hospital,
      departments: departmentsWithDoctors
    };
  }

  /**
   * Generates available demonstration appointment slots for a doctor on a given day.
   * Excludes past slots when booking for today, handles lunch break, and organizes into Morning & Afternoon sessions.
   */
  static getAvailableSlots(doctorId: number, dateStr?: string): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const now = new Date();

    // Check if target date is today in local comparison
    const isToday = targetDate.getFullYear() === now.getFullYear() &&
                    targetDate.getMonth() === now.getMonth() &&
                    targetDate.getDate() === now.getDate();
    const isHistorical = targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Normalize target date to noon local time so UTC conversion stays consistently on the calendar date across timezones
    const normalizedTarget = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      12,
      0,
      0
    );

    // Check booked slots specifically for this doctor on this target day
    const bookedAppts = db.prepare(`
      SELECT scheduled_time FROM appointments
      WHERE doctor_id = ? AND status NOT IN ('cancelled') AND date(scheduled_time) = date(?)
    `).all(doctorId, normalizedTarget.toISOString()) as { scheduled_time: string }[];

    const bookedHoursMins = new Set(
      bookedAppts.map(a => {
        const d = new Date(a.scheduled_time);
        return `${d.getHours()}:${d.getMinutes()}`;
      })
    );

    // Defined slot hours: Morning (09:00 - 12:30), Afternoon (14:00 - 17:30)
    const slotTimesConfig: { hour: number; minute: number; session: 'morning' | 'afternoon' }[] = [
      // Morning Session
      { hour: 9, minute: 0, session: 'morning' },
      { hour: 9, minute: 30, session: 'morning' },
      { hour: 10, minute: 0, session: 'morning' },
      { hour: 10, minute: 30, session: 'morning' },
      { hour: 11, minute: 0, session: 'morning' },
      { hour: 11, minute: 30, session: 'morning' },
      { hour: 12, minute: 0, session: 'morning' },
      { hour: 12, minute: 30, session: 'morning' },
      // Afternoon / Evening Session
      { hour: 14, minute: 0, session: 'afternoon' },
      { hour: 14, minute: 30, session: 'afternoon' },
      { hour: 15, minute: 0, session: 'afternoon' },
      { hour: 15, minute: 30, session: 'afternoon' },
      { hour: 16, minute: 0, session: 'afternoon' },
      { hour: 16, minute: 30, session: 'afternoon' },
      { hour: 17, minute: 0, session: 'afternoon' },
      { hour: 17, minute: 30, session: 'afternoon' },
    ];

    for (const conf of slotTimesConfig) {
      const slotTime = new Date(targetDate);
      slotTime.setHours(conf.hour, conf.minute, 0, 0);

      const ampm = conf.hour >= 12 ? 'PM' : 'AM';
      const displayH = conf.hour > 12 ? conf.hour - 12 : (conf.hour === 0 ? 12 : conf.hour);
      const displayM = conf.minute.toString().padStart(2, '0');
      const slotLabel = `${displayH}:${displayM} ${ampm}`;

      // Check if slot has already passed for today (allow 15m buffer)
      let isPast = isHistorical;
      if (isToday) {
        isPast = slotTime.getTime() <= now.getTime() + 15 * 60 * 1000;
      }

      const isBooked = bookedHoursMins.has(`${conf.hour}:${conf.minute}`);
      const isAvailable = !isPast && !isBooked;

      slots.push({
        time: slotTime.toISOString(),
        slotLabel,
        session: conf.session,
        isAvailable,
        isBooked,
        isPast
      });
    }

    return slots;
  }
}
