export type AppointmentStatus = 
  | 'booked' 
  | 'waiting' 
  | 'in_consultation' 
  | 'completed' 
  | 'cancelled' 
  | 'rescheduled' 
  | 'no_show';

export type QueueStatus = 'active' | 'paused';

export interface Hospital {
  id: number;
  name: string;
  locality: string;
  city: string;
  description: string;
  phone: string;
  open_time: string;
  close_time: string;
  is_open: number;
}

export interface Department {
  id: number;
  hospital_id: number;
  name: string;
  description: string;
}

export interface Doctor {
  id: number;
  hospital_id: number;
  department_id: number;
  name: string;
  specialization: string;
  default_avg_min: number;
}

export interface Queue {
  id: number;
  hospital_id: number;
  department_id: number;
  doctor_id: number;
  status: QueueStatus;
  delay_minutes: number;
  delay_reason: string | null;
  updated_at: string;
}

export interface Appointment {
  id: number;
  patient_id: string;
  patient_name: string;
  patient_phone?: string;
  visit_reason?: string;
  hospital_id: number;
  department_id: number;
  doctor_id: number;
  token_number: string;
  queue_position: number | null;
  scheduled_time: string; // ISO string
  status: AppointmentStatus;
  created_at: string;
  checkin_at: string | null;
  consultation_start_at: string | null;
  completed_at: string | null;
  // Joined display fields
  hospital_name?: string;
  department_name?: string;
  doctor_name?: string;
  locality?: string;
  queue_id?: number;
}

export interface ConsultationHistory {
  id: number;
  doctor_id: number;
  department_id: number;
  duration_minutes: number;
  completed_at: string;
  source: 'seed' | 'simulated';
}

export interface QueueEvent {
  id: number;
  queue_id: number;
  event_type: string;
  message: string;
  created_at: string;
}

export interface TimeSlot {
  time: string;
  slotLabel: string;
  session: 'morning' | 'afternoon';
  isAvailable: boolean;
  isBooked: boolean;
  isPast: boolean;
}

export interface ETAResult {
  estimatedMinutes: number;
  rangeLow: number;
  rangeHigh: number;
  patientsAhead: number;
  currentlyServingToken: string | null;
  queueStatus: QueueStatus;
  delayMinutes: number;
  delayReason: string | null;
  isQueuePaused: boolean;
  explanation: string;
  predictedDoctorDuration: number;
  // Pre-checkin and departure projections
  isPreCheckin?: boolean;
  expectedCallTime?: string; // e.g. "11:25 AM"
  recommendedArrivalTime?: string; // e.g. "11:05 AM"
  leaveHomeAdvice?: string;
  aheadBreakdown?: {
    inConsultation: number;
    waitingInLobby: number;
    bookedAhead: number;
  };
  safetyMarginMinutes?: number;
}

export interface ETAInsights {
  doctorId: number;
  doctorName: string;
  departmentName: string;
  sampleCount: number;
  doctorEWMA: number;
  departmentMedian: number;
  blendedDuration: number;
  activeDelayMinutes: number;
  queueStatus: QueueStatus;
  waitingCount: number;
  inConsultationCount: number;
  baselineETA: number;
  adaptiveETA: number;
  recentDurations: number[];
  explanation: string;
}

export interface HospitalSearchResult extends Hospital {
  departments: string[];
  currentQueueWait: number; // in minutes
  nextAvailableSlot: string; // e.g. "Today, 4:30 PM"
  waitingCount: number;
  activeDoctorsCount: number;
}
