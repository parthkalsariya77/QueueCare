import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../lib/api.js';
import { Appointment, TimeSlot } from '../../../shared/types.js';
import { QueueStatusBadge } from '../../components/QueueStatusBadge.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { useToast } from '../../components/Toast.js';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  ArrowRight,
  Search,
  User,
  Phone,
  FileText,
  X,
  RefreshCw
} from 'lucide-react';

export const PatientAppointments: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'past'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelModalAppt, setCancelModalAppt] = useState<Appointment | null>(null);

  // Reschedule state
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleDateOffset, setRescheduleDateOffset] = useState<number>(0);
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [selectedNewTime, setSelectedNewTime] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);

  // Fetch appointments with 60s polling
  const { data: appointments, loading, refetch } = usePolling<Appointment[]>(
    () => api.getAppointments(),
    60000
  );

  const handleCheckIn = async (appointmentId: number) => {
    try {
      await api.checkInAppointment(appointmentId);
      showToast('Checked in successfully! You are now in the active queue.', 'success');
      refetch();
      navigate(`/tracker?appointmentId=${appointmentId}`);
    } catch (err: any) {
      showToast('Check-in failed: ' + err.message, 'error');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalAppt) return;
    try {
      await api.cancelAppointment(cancelModalAppt.id);
      showToast(`Appointment for Token ${cancelModalAppt.token_number} cancelled.`, 'info');
      setCancelModalAppt(null);
      refetch();
    } catch (err: any) {
      showToast('Cancel failed: ' + err.message, 'error');
    }
  };

  const loadRescheduleSlots = async (doctorId: number, offset: number) => {
    setLoadingRescheduleSlots(true);
    setSelectedNewTime(null);
    try {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const slots = await api.getDoctorSlots(doctorId, d.toISOString());
      setRescheduleSlots(slots);
    } catch (err: any) {
      showToast('Failed to load slots: ' + err.message, 'error');
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  const handleOpenReschedule = async (appt: Appointment) => {
    setRescheduleAppt(appt);
    setRescheduleDateOffset(0);
    setSelectedNewTime(null);
    await loadRescheduleSlots(appt.doctor_id, 0);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleAppt || !selectedNewTime) return;
    setRescheduling(true);
    try {
      await api.rescheduleAppointment(rescheduleAppt.id, selectedNewTime);
      showToast(`Appointment rescheduled to ${new Date(selectedNewTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`, 'success');
      setRescheduleAppt(null);
      refetch();
    } catch (err: any) {
      showToast('Reschedule failed: ' + err.message, 'error');
    } finally {
      setRescheduling(false);
    }
  };

  const filteredAppointments = appointments?.filter(a => {
    // 1. Tab filter
    let matchesTab = true;
    if (filterTab === 'active') {
      matchesTab = a.status === 'booked' || a.status === 'waiting' || a.status === 'in_consultation';
    } else if (filterTab === 'past') {
      matchesTab = a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show';
    }

    // 2. Search keyword
    let matchesSearch = true;
    if (searchTerm.trim().length > 0) {
      const q = searchTerm.toLowerCase().trim();
      matchesSearch = 
        (a.hospital_name || '').toLowerCase().includes(q) ||
        (a.doctor_name || '').toLowerCase().includes(q) ||
        (a.department_name || '').toLowerCase().includes(q) ||
        (a.token_number || '').toLowerCase().includes(q) ||
        (a.visit_reason || '').toLowerCase().includes(q);
    }

    return matchesTab && matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Appointments & Tokens
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your booked consultations, check in to active queues, and track live waiting times.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            title="Refresh bookings"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-600" />
            <span>Sync</span>
          </button>
          <Link
            to="/hospitals"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs sm:text-sm shadow-sm transition w-fit"
          >
            <span>Book New Appointment</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Search and Tabs Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 md:pb-0">
          <button
            onClick={() => setFilterTab('active')}
            className={`px-4 py-2 rounded-xl font-bold transition whitespace-nowrap ${
              filterTab === 'active'
                ? 'bg-brand-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Upcoming & Active ({appointments?.filter(a => a.status === 'booked' || a.status === 'waiting' || a.status === 'in_consultation').length || 0})
          </button>

          <button
            onClick={() => setFilterTab('past')}
            className={`px-4 py-2 rounded-xl font-bold transition whitespace-nowrap ${
              filterTab === 'past'
                ? 'bg-brand-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Completed & History ({appointments?.filter(a => a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show').length || 0})
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded-xl font-bold transition whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-brand-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Appointments ({appointments?.length || 0})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by doctor, hospital, token..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-600 focus:bg-white transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          Loading your appointment records...
        </div>
      ) : filteredAppointments.length > 0 ? (
        <div className="space-y-4">
          {filteredAppointments.map(appt => (
            <div
              key={appt.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-brand-300 transition flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
            >
              {/* Left Details */}
              <div className="flex items-start gap-4">
                <div className="text-center px-4 py-3 bg-brand-50 border border-brand-100 rounded-2xl shrink-0 min-w-[80px]">
                  <div className="text-[10px] uppercase font-bold text-brand-700 tracking-wider">Token</div>
                  <div className="text-2xl font-extrabold text-brand-900 font-mono mt-0.5">
                    {appt.token_number}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900">{appt.hospital_name}</h3>
                    <QueueStatusBadge status={appt.status} size="sm" />
                  </div>
                  
                  <p className="text-xs text-slate-700 font-medium mt-1">
                    {appt.department_name} • <span className="font-bold text-slate-900">Dr. {appt.doctor_name}</span>
                  </p>

                  {appt.visit_reason && (
                    <p className="text-xs text-slate-500 mt-1 italic flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>"{appt.visit_reason}"</span>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2.5">
                    <span className="flex items-center gap-1 font-semibold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-brand-700" />
                      {new Date(appt.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>

                    {appt.locality && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {appt.locality}
                      </span>
                    )}

                    {appt.queue_position && (
                      <span className="font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100">
                        Queue Position: #{appt.queue_position}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                {appt.status === 'booked' && (
                  <>
                    <Link
                      to={`/tracker?appointmentId=${appt.id}`}
                      className="px-4 py-2 rounded-xl bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 font-bold text-xs transition flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>Track Turn & Departure</span>
                    </Link>
                    <button
                      onClick={() => handleCheckIn(appt.id)}
                      className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Check In / Join Queue
                    </button>
                    <button
                      onClick={() => handleOpenReschedule(appt)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => setCancelModalAppt(appt)}
                      className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {(appt.status === 'waiting' || appt.status === 'in_consultation') && (
                  <Link
                    to={`/tracker?appointmentId=${appt.id}`}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Live Queue Tracker</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}

                {appt.status === 'completed' && (
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Consultation Completed
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No appointments found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm ? 'No appointments matched your search query.' : 'Book a consultation at any clinic to receive your digital token.'}
          </p>
          {searchTerm ? (
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
            >
              Clear Search Filter
            </button>
          ) : (
            <Link
              to="/hospitals"
              className="inline-flex px-4 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-800 transition"
            >
              Find a Hospital & Doctor
            </Link>
          )}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(cancelModalAppt)}
        title="Cancel Appointment?"
        message={`Are you sure you want to cancel your appointment with Dr. ${cancelModalAppt?.doctor_name} at ${cancelModalAppt?.hospital_name}?`}
        confirmText="Confirm Cancellation"
        isDestructive={true}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelModalAppt(null)}
      />

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white">
              <h3 className="text-base font-bold">Reschedule Appointment</h3>
              <p className="text-xs text-slate-300 mt-0.5">Dr. {rescheduleAppt.doctor_name} • {rescheduleAppt.hospital_name}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Multi-Date Offset Switcher */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Select Consultation Date
                </span>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                  {[0, 1, 2].map(offset => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
                    return (
                      <button
                        key={offset}
                        type="button"
                        onClick={() => {
                          setRescheduleDateOffset(offset);
                          if (rescheduleAppt) loadRescheduleSlots(rescheduleAppt.doctor_id, offset);
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg transition text-center ${
                          rescheduleDateOffset === offset
                            ? 'bg-white text-brand-900 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-600 font-medium block mb-2">Available Consultation Slots:</span>
                {loadingRescheduleSlots ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading slots...</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                    {rescheduleSlots.map(s => (
                      <button
                        key={s.time}
                        disabled={!s.isAvailable}
                        onClick={() => setSelectedNewTime(s.time)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border transition text-center ${
                          !s.isAvailable
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                            : selectedNewTime === s.time
                            ? 'bg-brand-700 text-white border-brand-700 shadow-xs ring-2 ring-brand-500'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-brand-500'
                        }`}
                      >
                        {s.slotLabel}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRescheduleAppt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedNewTime || rescheduling}
                  onClick={handleConfirmReschedule}
                  className="px-5 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
                >
                  {rescheduling ? 'Updating...' : 'Confirm Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
