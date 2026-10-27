import { db } from '../db/connection.js';
import { ETAResult, ETAInsights, QueueStatus } from '../../shared/types.js';

export interface DoctorHistoryItem {
  duration_minutes: number;
  completed_at: string;
}

/**
 * Calculates the Exponentially Weighted Moving Average (EWMA)
 * with alpha = 0.30 over chronological durations.
 * Recent consultations are weighted more heavily.
 */
export function calculateEWMA(durations: number[], alpha = 0.30): number {
  if (!durations || durations.length === 0) return 0;
  let ewma = durations[0];
  for (let i = 1; i < durations.length; i++) {
    ewma = alpha * durations[i] + (1 - alpha) * ewma;
  }
  return Number(ewma.toFixed(1));
}

/**
 * Calculates standard median of numbers.
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number(median.toFixed(1));
}

/**
 * Calculates sample standard deviation.
 */
export function calculateStdDev(values: number[]): number {
  if (!values || values.length < 2) return 2.5; // reasonable fallback variance
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Number(Math.sqrt(variance).toFixed(1));
}

/**
 * Smooths doctor EWMA with department-level median using smoothing constant k=5.
 * Prevents overreacting when a doctor has very few historical records.
 */
export function blendDuration(
  doctorEWMA: number,
  departmentMedian: number,
  doctorSampleCount: number,
  k = 5
): number {
  if (doctorSampleCount === 0) return departmentMedian;
  const doctorWeight = doctorSampleCount / (doctorSampleCount + k);
  const blended = doctorWeight * doctorEWMA + (1 - doctorWeight) * departmentMedian;
  return Number(blended.toFixed(1));
}

/**
 * Gets predicted consultation duration for a given doctor.
 */
export function getDoctorPredictedDuration(doctorId: number, departmentId: number): {
  predictedDuration: number;
  doctorEWMA: number;
  departmentMedian: number;
  doctorSampleCount: number;
  recentDurations: number[];
  stdDev: number;
} {
  // Fetch doctor's completed consultations in chronological order
  const doctorRows = db.prepare(`
    SELECT duration_minutes, completed_at
    FROM consultation_history
    WHERE doctor_id = ?
    ORDER BY datetime(completed_at) ASC
  `).all(doctorId) as { duration_minutes: number; completed_at: string }[];

  // Fetch department's consultations for baseline median
  const deptRows = db.prepare(`
    SELECT duration_minutes
    FROM consultation_history
    WHERE department_id = ?
  `).all(departmentId) as { duration_minutes: number }[];

  const doctorDurations = doctorRows.map(r => r.duration_minutes);
  const deptDurations = deptRows.map(r => r.duration_minutes);

  const departmentMedian = deptDurations.length > 0 ? calculateMedian(deptDurations) : 10;

  if (doctorDurations.length === 0) {
    return {
      predictedDuration: departmentMedian,
      doctorEWMA: departmentMedian,
      departmentMedian,
      doctorSampleCount: 0,
      recentDurations: [],
      stdDev: 2.5
    };
  }

  const doctorEWMA = calculateEWMA(doctorDurations);
  const blended = blendDuration(doctorEWMA, departmentMedian, doctorDurations.length);
  const stdDev = calculateStdDev(doctorDurations);

  return {
    predictedDuration: blended,
    doctorEWMA,
    departmentMedian,
    doctorSampleCount: doctorDurations.length,
    recentDurations: doctorDurations.slice(-8), // latest 8
    stdDev
  };
}

/**
 * Calculates queue-aware ETA for a specific appointment in an active queue.
 */
export function calculateAppointmentETA(appointmentId: number): ETAResult {
  const appointment = db.prepare(`
    SELECT a.*, q.id as queue_id, q.status as queue_status, q.delay_minutes, q.delay_reason
    FROM appointments a
    LEFT JOIN queues q ON q.doctor_id = a.doctor_id
    WHERE a.id = ?
  `).get(appointmentId) as any;

  if (!appointment) {
    return {
      estimatedMinutes: 0,
      rangeLow: 0,
      rangeHigh: 0,
      patientsAhead: 0,
      currentlyServingToken: null,
      queueStatus: 'active',
      delayMinutes: 0,
      delayReason: null,
      isQueuePaused: false,
      explanation: 'Appointment not found.',
      predictedDoctorDuration: 10
    };
  }

  const { queue_status, delay_minutes = 0, delay_reason, doctor_id, department_id, status } = appointment;
  const isQueuePaused = queue_status === 'paused';

  // Get current serving patient in this doctor's queue
  const currentServing = db.prepare(`
    SELECT token_number, consultation_start_at
    FROM appointments
    WHERE doctor_id = ? AND status = 'in_consultation'
    LIMIT 1
  `).get(doctor_id) as { token_number: string; consultation_start_at: string | null } | undefined;

  const currentlyServingToken = currentServing ? currentServing.token_number : null;

  // If appointment is already completed or in consultation
  if (status === 'in_consultation') {
    return {
      estimatedMinutes: 0,
      rangeLow: 0,
      rangeHigh: 5,
      patientsAhead: 0,
      currentlyServingToken,
      queueStatus: queue_status || 'active',
      delayMinutes: delay_minutes,
      delayReason: delay_reason || null,
      isQueuePaused,
      explanation: 'You are currently being seen by the doctor.',
      predictedDoctorDuration: 10
    };
  }

  if (status === 'completed') {
    return {
      estimatedMinutes: 0,
      rangeLow: 0,
      rangeHigh: 0,
      patientsAhead: 0,
      currentlyServingToken,
      queueStatus: queue_status || 'active',
      delayMinutes: 0,
      delayReason: null,
      isQueuePaused,
      explanation: 'Consultation completed.',
      predictedDoctorDuration: 10
    };
  }

  // Get doctor stats
  const { predictedDuration, doctorEWMA, departmentMedian, doctorSampleCount, stdDev } = 
    getDoctorPredictedDuration(doctor_id, department_id);

  // Compute remaining time for currently serving patient
  let remainingCurrent = 0;
  let inProgressCount = 0;
  if (currentServing) {
    inProgressCount = 1;
    if (currentServing.consultation_start_at) {
      const elapsedMs = Date.now() - new Date(currentServing.consultation_start_at).getTime();
      const elapsedMinutes = Math.max(0, elapsedMs / (1000 * 60));
      remainingCurrent = Math.max(1, Math.round(predictedDuration - elapsedMinutes));
    } else {
      remainingCurrent = Math.round(predictedDuration);
    }
  }

  // Count active waiting and scheduled patients ahead of this appointment in the queue
  let patientsAhead = 0;
  let waitingInLobby = 0;
  let bookedAhead = 0;

  if (status === 'waiting') {
    const aheadRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE doctor_id = ? 
        AND status = 'waiting'
        AND queue_position < ?
    `).get(doctor_id, appointment.queue_position || 9999) as { count: number };
    patientsAhead = aheadRow.count;
    waitingInLobby = patientsAhead;
  } else {
    // If appointment is still 'booked' (not checked in yet), count currently waiting patients
    const waitingRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE doctor_id = ? AND status = 'waiting'
    `).get(doctor_id) as { count: number };
    waitingInLobby = waitingRow.count;

    // Count earlier booked appointments for today's session
    const earlierBookedRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE doctor_id = ? 
        AND status = 'booked'
        AND id != ?
        AND date(scheduled_time) = date(?)
        AND (
          datetime(scheduled_time) < datetime(?) OR 
          (datetime(scheduled_time) = datetime(?) AND id < ?)
        )
    `).get(doctor_id, appointment.id, appointment.scheduled_time, appointment.scheduled_time, appointment.scheduled_time, appointment.id) as { count: number };
    bookedAhead = earlierBookedRow.count;

    patientsAhead = waitingInLobby + bookedAhead;
  }

  // Sum waiting workload
  const isPreCheckin = status === 'booked';
  const safetyMarginMinutes = Math.min(8, Math.max(3, Math.round(stdDev * 1.2)));

  const waitingWorkloadMinutes = patientsAhead * predictedDuration;
  const totalBaseMinutes = remainingCurrent + waitingWorkloadMinutes;
  const finalETA = Math.round(totalBaseMinutes + delay_minutes);

  // Range calculation using variability and workload count
  const effectiveWorkloadCount = Math.max(1, patientsAhead + inProgressCount);
  const margin = Math.round(stdDev * Math.sqrt(effectiveWorkloadCount));
  const rangeLow = Math.max(0, finalETA - margin);
  const rangeHigh = finalETA + margin + (isPreCheckin ? safetyMarginMinutes : 0);

  // Pre-checkin time projections (e.g. Expected Call Time & Recommended Arrival Time)
  const now = new Date();
  const callDate = new Date(now.getTime() + (finalETA * 60 * 1000));
  const callHours = callDate.getHours();
  const callMins = callDate.getMinutes().toString().padStart(2, '0');
  const callAmpm = callHours >= 12 ? 'PM' : 'AM';
  const callDisplayH = callHours > 12 ? callHours - 12 : (callHours === 0 ? 12 : callHours);
  const expectedCallTime = `${callDisplayH}:${callMins} ${callAmpm}`;

  const arrivalBufferMin = 20;
  const arrivalDate = new Date(now.getTime() + Math.max(5, (finalETA - arrivalBufferMin)) * 60 * 1000);
  const arrHours = arrivalDate.getHours();
  const arrMins = arrivalDate.getMinutes().toString().padStart(2, '0');
  const arrAmpm = arrHours >= 12 ? 'PM' : 'AM';
  const arrDisplayH = arrHours > 12 ? arrHours - 12 : (arrHours === 0 ? 12 : arrHours);
  const recommendedArrivalTime = `${arrDisplayH}:${arrMins} ${arrAmpm}`;

  const leaveHomeAdvice = finalETA <= 30
    ? 'Proceed to clinic now. Your consultation turn is approaching shortly.'
    : `Recommended to depart home around ${recommendedArrivalTime} (allows transit and reception check-in). Expected call at ~${expectedCallTime}.`;

  let explanation = '';
  if (isQueuePaused) {
    explanation = 'The doctor queue is temporarily paused by hospital staff.';
  } else if (isPreCheckin) {
    explanation = `Projected pre-checkin estimate: ${patientsAhead} patients ahead in today's OPD schedule (${waitingInLobby} waiting in lobby, ${bookedAhead} booked prior, doctor pace ~${predictedDuration}m/patient). Includes a +${safetyMarginMinutes}m safety margin.`;
  } else if (delay_minutes > 0) {
    explanation = `Adaptive estimate (${patientsAhead} waiting ahead + current patient remaining ~${remainingCurrent}m) with +${delay_minutes}m staff delay: ${delay_reason || 'Operational delay'}.`;
  } else {
    explanation = `Adaptive estimate based on doctor's EWMA pace (~${predictedDuration}m/patient) with ${patientsAhead} patients ahead in OPD lobby.`;
  }

  return {
    estimatedMinutes: finalETA,
    rangeLow,
    rangeHigh,
    patientsAhead,
    currentlyServingToken,
    queueStatus: queue_status || 'active',
    delayMinutes: delay_minutes,
    delayReason: delay_reason || null,
    isQueuePaused,
    explanation,
    predictedDoctorDuration: predictedDuration,
    isPreCheckin,
    expectedCallTime,
    recommendedArrivalTime,
    leaveHomeAdvice,
    aheadBreakdown: {
      inConsultation: inProgressCount,
      waitingInLobby,
      bookedAhead
    },
    safetyMarginMinutes
  };
}

/**
 * Compares Adaptive EWMA model with Baseline fixed-average model
 * for staff ETA Insights panel.
 */
export function getETAInsightsForQueue(queueId: number): ETAInsights | null {
  const queue = db.prepare(`
    SELECT q.*, d.name as doctor_name, dept.name as department_name
    FROM queues q
    JOIN doctors d ON d.id = q.doctor_id
    JOIN departments dept ON dept.id = q.department_id
    WHERE q.id = ?
  `).get(queueId) as any;

  if (!queue) return null;

  const { predictedDuration, doctorEWMA, departmentMedian, doctorSampleCount, recentDurations } = 
    getDoctorPredictedDuration(queue.doctor_id, queue.department_id);

  // Active counts
  const waitingRow = db.prepare(`
    SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = 'waiting'
  `).get(queue.doctor_id) as { count: number };

  const inConsRow = db.prepare(`
    SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = 'in_consultation'
  `).get(queue.doctor_id) as { count: number };

  const waitingCount = waitingRow.count;
  const inConsultationCount = inConsRow.count;
  const totalInQueue = waitingCount + inConsultationCount;

  // Baseline estimate: purely department median * total in queue + delay
  const baselineETA = Math.round((totalInQueue * departmentMedian) + queue.delay_minutes);

  // Adaptive estimate: blended EWMA * total in queue + delay
  const adaptiveETA = Math.round((totalInQueue * predictedDuration) + queue.delay_minutes);

  const diff = adaptiveETA - baselineETA;
  let explanation = '';
  if (diff > 0) {
    explanation = `Adaptive EWMA is ${diff}m higher than department baseline because recent consultations for Dr. ${queue.doctor_name} have trended longer (${doctorEWMA}m vs ${departmentMedian}m median).`;
  } else if (diff < 0) {
    explanation = `Adaptive EWMA is ${Math.abs(diff)}m faster than baseline because Dr. ${queue.doctor_name} has completed recent consultations more swiftly (${doctorEWMA}m vs ${departmentMedian}m median).`;
  } else {
    explanation = `Adaptive EWMA aligns closely with the department baseline median of ${departmentMedian} minutes per patient.`;
  }

  return {
    doctorId: queue.doctor_id,
    doctorName: queue.doctor_name,
    departmentName: queue.department_name,
    sampleCount: doctorSampleCount,
    doctorEWMA,
    departmentMedian,
    blendedDuration: predictedDuration,
    activeDelayMinutes: queue.delay_minutes,
    queueStatus: queue.status,
    waitingCount,
    inConsultationCount,
    baselineETA,
    adaptiveETA,
    recentDurations,
    explanation
  };
}
