import React from 'react';
import { Link } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../lib/api.js';
import { Appointment } from '../../../shared/types.js';
import { QueueStatusBadge } from '../../components/QueueStatusBadge.js';
import { 
  Clock, 
  Building2, 
  Calendar, 
  ArrowRight, 
  Users, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  // Fetch appointments with 60s background auto-sync
  const { data: appointments, loading, refetch } = usePolling<Appointment[]>(
    () => api.getAppointments(),
    60000
  );

  // Active queue entries (waiting or in_consultation)
  const activeAppts = appointments?.filter(a => a.status === 'waiting' || a.status === 'in_consultation') || [];
  const primaryActive = activeAppts[0];
  const upcomingBookings = appointments?.filter(a => a.status === 'booked') || [];
  const pastConsultations = appointments?.filter(a => a.status === 'completed') || [];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-brand-900/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-teal-200 mb-4 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>OPD Queue Transparency Network • Ahmedabad & Gandhinagar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, Rohan Mehta
          </h1>
          <p className="mt-2 text-teal-100 text-sm sm:text-base leading-relaxed">
            Access transparent outpatient waiting times, digital tokens, and live consultation updates. Plan your hospital visits with confidence.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/hospitals"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-brand-900 font-bold text-xs sm:text-sm shadow hover:bg-teal-50 transition"
            >
              <Building2 className="w-4 h-4 text-brand-700" />
              Find Hospitals & Doctors
            </Link>
            <Link
              to="/appointments"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-950/40 text-white font-bold text-xs sm:text-sm hover:bg-brand-950/60 transition border border-white/15"
            >
              <Calendar className="w-4 h-4 text-teal-300" />
              Manage Appointments ({appointments?.length || 0})
            </Link>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/20 text-teal-200 font-bold text-xs sm:text-sm hover:bg-teal-500/30 transition border border-teal-400/30"
              title="Sync appointments"
            >
              <RefreshCw className="w-4 h-4 text-teal-300" />
              Sync Live Status
            </button>
          </div>
        </div>
      </div>

      {/* Active Queue Card (if patient has a waiting or in_consultation appointment) */}
      {primaryActive ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-brand-200 shadow-lg shadow-brand-100/50 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 live-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Active Consultation Queue
                </span>
                <QueueStatusBadge status={primaryActive.status} size="sm" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {primaryActive.hospital_name}
              </h2>
              <p className="text-slate-600 text-sm mt-0.5">
                {primaryActive.department_name} • Dr. {primaryActive.doctor_name}
              </p>
              {primaryActive.visit_reason && (
                <p className="text-xs text-slate-500 mt-1 italic">
                  "{primaryActive.visit_reason}"
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 w-full md:w-auto">
              <div className="text-center px-4 border-r border-slate-200">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Token</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-brand-700 font-mono mt-0.5">
                  {primaryActive.token_number}
                </div>
              </div>
              <div className="text-center px-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Queue Position</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-0.5">
                  #{primaryActive.queue_position || 1}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-4 h-4 text-brand-600" />
              <span>Live adaptive updates synced with doctor's chamber (auto-syncs every 60s).</span>
            </div>

            <Link
              to={`/tracker?appointmentId=${primaryActive.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs sm:text-sm transition shadow-sm w-full sm:w-auto justify-center"
            >
              <span>Open Live Queue Tracker</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">No active queue ticket at this moment</h3>
              <p className="text-xs text-slate-500">Book an appointment or check in to start tracking your estimated waiting time.</p>
            </div>
          </div>
          <Link
            to="/hospitals"
            className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold transition shrink-0"
          >
            Browse Available Doctors
          </Link>
        </div>
      )}

      {/* Grid: All Bookings Overview + Professional Clinical Care Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Your Appointments & History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-700" />
              Your Appointments ({appointments?.length || 0})
            </h3>
            <Link to="/appointments" className="text-xs font-bold text-brand-700 hover:underline">
              View Complete Details →
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                Loading appointments...
              </div>
            ) : appointments && appointments.length > 0 ? (
              appointments.map(appt => (
                <div
                  key={appt.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-brand-300 transition shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex flex-col items-center justify-center font-mono shrink-0">
                      <span className="text-[9px] uppercase font-bold text-brand-700">Token</span>
                      <span className="font-extrabold text-xs text-brand-900">{appt.token_number}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{appt.hospital_name}</h4>
                        <QueueStatusBadge status={appt.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {appt.department_name} • Dr. {appt.doctor_name}
                      </p>
                      {appt.visit_reason && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">
                          "{appt.visit_reason}"
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-brand-600" />
                        {new Date(appt.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {appt.status === 'booked' && (
                      <Link
                        to="/appointments"
                        className="px-3.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold text-xs transition"
                      >
                        Check In / Details
                      </Link>
                    )}
                    {(appt.status === 'waiting' || appt.status === 'in_consultation') && (
                      <Link
                        to={`/tracker?appointmentId=${appt.id}`}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Live Track
                      </Link>
                    )}
                    {appt.status === 'completed' && (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                        Consultation Done
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                No appointments found. Click 'Find Hospitals & Doctors' to book one.
              </div>
            )}
          </div>
        </div>

        {/* Right: Hospital Network Status & Clinical Care Guidelines */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-700" />
            Live OPD Network Status
          </h3>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Zydus Super Specialty</span>
                <span className="text-[11px] text-slate-500">Thaltej, SG Highway</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                OPD Open (~15m avg)
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Apollo Clinic</span>
                <span className="text-[11px] text-slate-500">Sector 21, Gandhinagar</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                OPD Open (~10m avg)
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Civil Medicity OPD</span>
                <span className="text-[11px] text-slate-500">Asarwa, Ahmedabad</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                High Volume (~20m)
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Shanti Community Hospital</span>
                <span className="text-[11px] text-slate-500">Navrangpura</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                OPD Open (~8m avg)
              </span>
            </div>
          </div>

          {/* Patient Arrival Checklist */}
          <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-200 shadow-xs space-y-3 text-xs text-teal-950">
            <h4 className="font-bold text-sm flex items-center gap-1.5 text-brand-900">
              <CheckCircle2 className="w-4 h-4 text-teal-700" />
              Patient OPD Preparation
            </h4>
            <ul className="space-y-2 text-[11px] text-slate-700">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0"></span>
                <span>Arrive at the OPD reception approximately 10–15 minutes before your token estimate.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0"></span>
                <span>Carry past medical records, prescriptions, and recent diagnostic lab reports.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0"></span>
                <span>Present your digital token number on your mobile screen at the consultation chamber.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
