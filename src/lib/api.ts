import { 
  HospitalSearchResult, 
  Hospital, 
  Appointment, 
  ETAResult, 
  ETAInsights, 
  QueueEvent, 
  QueueStatus,
  TimeSlot
} from '../../shared/types.js';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `HTTP ${res.status}: Failed to fetch ${url}`);
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Discovery
  getHospitals: (params?: { q?: string; department?: string; locality?: string; openOnly?: boolean; maxWait?: number; sort?: string }) => {
    const qry = new URLSearchParams();
    if (params?.q) qry.set('q', params.q);
    if (params?.department && params.department !== 'all') qry.set('department', params.department);
    if (params?.locality && params.locality !== 'all') qry.set('locality', params.locality);
    if (params?.openOnly) qry.set('openOnly', 'true');
    if (params?.maxWait) qry.set('maxWait', params.maxWait.toString());
    if (params?.sort) qry.set('sort', params.sort);
    return fetchJson<HospitalSearchResult[]>(`/hospitals?${qry.toString()}`);
  },

  getHospitalDetail: (id: number) => fetchJson<any>(`/hospitals/${id}`),
  getDepartments: () => fetchJson<string[]>('/hospitals/meta/departments'),
  getLocalities: () => fetchJson<string[]>('/hospitals/meta/localities'),
  getDoctorSlots: (doctorId: number, date?: string) => {
    const qry = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchJson<TimeSlot[]>(`/hospitals/doctors/${doctorId}/slots${qry}`);
  },

  // Appointments
  getAppointments: (status?: string) => {
    const qry = status && status !== 'all' ? `?status=${status}` : '';
    return fetchJson<Appointment[]>(`/appointments${qry}`);
  },

  getAppointmentDetail: (id: number) => fetchJson<Appointment & { eta: ETAResult; events: QueueEvent[] }>(`/appointments/${id}`),

  bookAppointment: (data: { 
    hospitalId: number; 
    departmentId: number; 
    doctorId: number; 
    scheduledTime: string; 
    patientName?: string;
    patientPhone?: string;
    visitReason?: string;
  }) =>
    fetchJson<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  checkInAppointment: (id: number) =>
    fetchJson<Appointment & { eta: ETAResult }>(`/appointments/${id}/checkin`, { method: 'POST' }),

  cancelAppointment: (id: number) =>
    fetchJson<{ message: string }>(`/appointments/${id}/cancel`, { method: 'POST' }),

  rescheduleAppointment: (id: number, newScheduledTime: string) =>
    fetchJson<Appointment>(`/appointments/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newScheduledTime })
    }),

  // Queues
  getQueueDetail: (id: number) => fetchJson<any>(`/queues/${id}`),
  getQueueEntries: (id: number) => fetchJson<Appointment[]>(`/queues/${id}/entries`),
  getQueueEvents: (id: number) => fetchJson<QueueEvent[]>(`/queues/${id}/events`),
  getQueueInsights: (id: number) => fetchJson<ETAInsights>(`/queues/${id}/insights`),

  // Staff Operations
  getStaffOverview: (hospitalId?: number) => {
    const qry = hospitalId ? `?hospitalId=${hospitalId}` : '';
    return fetchJson<any>(`/staff/overview${qry}`);
  },

  startConsultation: (queueId: number) =>
    fetchJson<Appointment>('/staff/start-consultation', {
      method: 'POST',
      body: JSON.stringify({ queueId })
    }),

  completeConsultation: (appointmentId: number, durationMinutes: number) =>
    fetchJson<Appointment>('/staff/complete-consultation', {
      method: 'POST',
      body: JSON.stringify({ appointmentId, durationMinutes })
    }),

  setDelay: (queueId: number, delayMinutes: number, reason?: string) =>
    fetchJson<void>('/staff/set-delay', {
      method: 'POST',
      body: JSON.stringify({ queueId, delayMinutes, reason })
    }),

  togglePause: (queueId: number, status: QueueStatus, reason?: string) =>
    fetchJson<void>('/staff/toggle-pause', {
      method: 'POST',
      body: JSON.stringify({ queueId, status, reason })
    }),

  markNoShow: (appointmentId: number) =>
    fetchJson<void>('/staff/mark-no-show', {
      method: 'POST',
      body: JSON.stringify({ appointmentId })
    }),

  resetDemo: () =>
    fetchJson<{ message: string }>('/staff/reset-demo', { method: 'POST' })
};
