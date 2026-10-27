import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../lib/api.js';
import { Appointment, ETAResult, QueueEvent } from '../../../shared/types.js';
import { QueueStatusBadge } from '../../components/QueueStatusBadge.js';
import { useToast } from '../../components/Toast.js';
import { 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  PauseCircle, 
  Sparkles, 
  ArrowRight,
  Activity,
  Calendar,
  Building2,
  RefreshCw,
  PhoneCall,
  UserCheck,
  X
} from 'lucide-react';

export const QueueTracker: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlApptId = searchParams.get('appointmentId') ? Number(searchParams.get('appointmentId')) : null;
  const { showToast } = useToast();

  // Step 1: Poll patient's appointments (60s calm interval)
  const { data: appointments, loading: loadingAppts, refetch: refetchAppts } = usePolling<Appointment[]>(
    () => api.getAppointments(),
    60000
  );

  // Active / trackable appointments (waiting, in_consultation, or booked)
  const trackableAppts = appointments?.filter(
    a => a.status === 'in_consultation' || a.status === 'waiting' || a.status === 'booked'
  ) || [];

  // Determine currently selected appointment
  let activeAppt = trackableAppts.find(a => a.id === urlApptId);
  if (!activeAppt) {
    // Fallback: pick the first waiting or in_consultation, else the first booked
    activeAppt = trackableAppts.find(a => a.status === 'in_consultation' || a.status === 'waiting') || trackableAppts[0];
  }

  // Step 2: Poll detailed appointment + live ETA + queue events (60s sync, immediately re-fetching when activeAppt changes)
  const { data: apptDetail, refetch: refetchDetail } = usePolling<Appointment & { eta: ETAResult; events: QueueEvent[] }>(
    () => activeAppt ? api.getAppointmentDetail(activeAppt.id) : Promise.reject('No active appointment'),
    60000,
    Boolean(activeAppt),
    [activeAppt?.id]
  );

  const events = apptDetail?.events || [];

  // Snapshot tracking for sudden queue events (Queue Resumed, Early Turn Jump)
  const prevSnapshotRef = useRef<{
    isPaused?: boolean;
    estimatedMinutes?: number;
    patientsAhead?: number;
    appointmentId?: number;
  }>({});

  const [activeAlert, setActiveAlert] = useState<{
    type: 'resumed' | 'early_turn';
    title: string;
    message: string;
    badge: string;
  } | null>(null);

  useEffect(() => {
    if (!apptDetail?.eta) return;
    const currentEta = apptDetail.eta;
    const prev = prevSnapshotRef.current;

    // Only compare if we're observing the exact same appointment
    if (prev.appointmentId === apptDetail.id) {
      // 1. Queue Resumed Notification: previously paused, now active
      if (prev.isPaused === true && currentEta.isQueuePaused === false) {
        setActiveAlert({
          type: 'resumed',
          title: 'OPD Queue Resumed',
          message: `Dr. ${apptDetail.doctor_name}'s queue has resumed consultations! Please be ready near the consultation chamber.`,
          badge: 'Consultation Resumed'
        });
        showToast(`Queue Resumed! Dr. ${apptDetail.doctor_name}'s queue is active now.`, 'success');
      }
      // 2. Sudden Early Turn Jump: wait shortened by >= 10m OR queue ahead jumped by >= 2
      else if (
        prev.estimatedMinutes !== undefined &&
        prev.patientsAhead !== undefined &&
        (prev.estimatedMinutes - currentEta.estimatedMinutes >= 10 ||
         prev.patientsAhead - currentEta.patientsAhead >= 2) &&
        !currentEta.isQueuePaused &&
        activeAppt?.status !== 'completed'
      ) {
        const minSaved = Math.max(0, prev.estimatedMinutes - currentEta.estimatedMinutes);
        const spotsJumped = Math.max(0, prev.patientsAhead - currentEta.patientsAhead);

        setActiveAlert({
          type: 'early_turn',
          title: 'Turn Advanced Earlier!',
          message: `Your turn moved forward swiftly (${spotsJumped > 0 ? `${spotsJumped} spot${spotsJumped > 1 ? 's' : ''} ahead advanced` : `${minSaved}m faster`}) due to swift pace or a patient no-show ahead. Expected call: ~${currentEta.expectedCallTime || 'Soon'}.`,
          badge: 'Turn Accelerated'
        });
        showToast(`Turn Advanced Earlier! Token ${apptDetail.token_number} is now closer to consultation.`, 'info');
      }
    }

    // Persist current snapshot
    prevSnapshotRef.current = {
      isPaused: currentEta.isQueuePaused,
      estimatedMinutes: currentEta.estimatedMinutes,
      patientsAhead: currentEta.patientsAhead,
      appointmentId: apptDetail.id
    };
  }, [apptDetail, showToast, activeAppt?.status]);

  const handleSelectAppointment = (apptId: number) => {
    setSearchParams({ appointmentId: apptId.toString() });
  };

  const handleInlineCheckIn = async (apptId: number) => {
    try {
      await api.checkInAppointment(apptId);
      showToast('Checked in successfully! You are now in the live queue.', 'success');
      refetchAppts();
      refetchDetail();
    } catch (err: any) {
      showToast('Check-in failed: ' + err.message, 'error');
    }
  };

  if (loadingAppts && !appointments) {
    return (
      <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
        Connecting to clinic queue monitor...
      </div>
    );
  }

  if (!activeAppt) {
    return (
      <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-4 max-w-lg mx-auto shadow-sm">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Active Queue Ticket</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          You don't have an active or upcoming appointment ticket right now. Book a consultation to receive your digital OPD token.
        </p>
        <div className="pt-2">
          <Link
            to="/hospitals"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-700 text-white font-bold text-xs shadow hover:bg-brand-800 transition"
          >
            <span>Find Hospitals & Doctors</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const eta = apptDetail?.eta;
  const isPaused = eta?.isQueuePaused;
  const isServingMe = activeAppt.status === 'in_consultation';
  const isBookedOnly = activeAppt.status === 'booked';
  const hasDelay = (eta?.delayMinutes || 0) > 0;

  // Calculate progress estimation
  const totalAhead = Math.max(1, (eta?.patientsAhead || 0) + (isServingMe ? 0 : 1));
  const progressPercent = isServingMe 
    ? 100 
    : isBookedOnly
    ? 10
    : Math.max(20, Math.min(90, Math.round((1 - (eta?.patientsAhead || 0) / (totalAhead + 2)) * 100)));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Multi-Ticket Switcher (if patient has multiple appointments) */}
      {trackableAppts.length > 1 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
            <span className="font-bold text-slate-700">Your Active & Upcoming Tokens:</span>
            <span>Click token to switch view</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {trackableAppts.map(appt => (
              <button
                key={appt.id}
                onClick={() => handleSelectAppointment(appt.id)}
                className={`px-4 py-2.5 rounded-xl text-left border transition shrink-0 flex items-center gap-3 ${
                  activeAppt?.id === appt.id
                    ? 'bg-brand-900 text-white border-brand-900 shadow-sm ring-2 ring-brand-500'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-mono font-extrabold text-sm">
                  {appt.token_number}
                </div>
                <div className="text-left">
                  <div className={`text-[11px] font-bold ${activeAppt?.id === appt.id ? 'text-teal-200' : 'text-slate-800'}`}>
                    {appt.doctor_name}
                  </div>
                  <div className={`text-[10px] ${activeAppt?.id === appt.id ? 'text-slate-300' : 'text-slate-500'}`}>
                    {appt.hospital_name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live sync banner */}
      <div className="flex items-center justify-between text-xs text-slate-500 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 live-pulse"></span>
          <span className="font-semibold text-slate-800">Connected to Clinic Monitor</span>
          <span className="hidden sm:inline text-slate-400">• Synchronized with OPD chamber (Auto-syncs every 60s)</span>
        </div>
        <button
          onClick={() => { refetchAppts(); refetchDetail(); }}
          className="text-brand-700 hover:text-brand-800 font-bold flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Live Queue</span>
        </button>
      </div>

      {/* Pre-Checkin Smart Departure Advisory (For Booked Appointments sitting at home) */}
      {isBookedOnly && (
        <div className="bg-gradient-to-r from-teal-900 to-brand-900 text-white rounded-3xl p-6 shadow-md border border-teal-700/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-400/30 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                <span>Pre-Checkin Smart Departure Advisory</span>
              </div>
              <h2 className="text-xl font-extrabold text-white">
                When to Leave Home for Your Consultation
              </h2>
              <p className="text-xs text-teal-200 mt-1 max-w-xl">
                {eta?.leaveHomeAdvice || 'Plan your departure so you arrive comfortably without excessive waiting room delay.'}
              </p>
            </div>

            <button
              onClick={() => handleInlineCheckIn(activeAppt.id)}
              className="px-5 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs shadow-md transition shrink-0 flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>I Have Arrived • Check In</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-teal-800 text-xs">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold text-teal-300 block">Recommended Departure</span>
              <span className="text-lg font-black text-white font-mono mt-0.5 block">{eta?.recommendedArrivalTime || '20m prior'}</span>
              <span className="text-[10px] text-teal-200">Commute & check-in leeway</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold text-teal-300 block">Projected Call Time</span>
              <span className="text-lg font-black text-white font-mono mt-0.5 block">{eta?.expectedCallTime || 'Today'}</span>
              <span className="text-[10px] text-teal-200">Doctor chamber entry</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold text-teal-300 block">Safety Leeway Margin</span>
              <span className="text-lg font-black text-white font-mono mt-0.5 block">+{eta?.safetyMarginMinutes ?? 4} mins</span>
              <span className="text-[10px] text-teal-200">Protected against no-show jumps</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Sudden Queue Event Alert (Early Turn / Queue Resumed) */}
      {activeAlert && (
        <div className={`rounded-2xl p-4 flex items-start justify-between gap-3.5 shadow-sm animate-fadeIn ${
          activeAlert.type === 'resumed'
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
            : 'bg-teal-50 border border-teal-300 text-teal-950'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              activeAlert.type === 'resumed' ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-sm block">{activeAlert.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                  activeAlert.type === 'resumed' ? 'bg-emerald-200 text-emerald-800' : 'bg-teal-200 text-teal-800'
                }`}>
                  {activeAlert.badge}
                </span>
              </div>
              <p className="leading-relaxed font-medium">{activeAlert.message}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveAlert(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Staff Delay Alert Banner */}
      {hasDelay && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3.5 text-amber-900 shadow-xs animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm block">Clinic Queue Schedule Notice</span>
            Staff has announced an operational delay of <strong>+{eta?.delayMinutes} minutes</strong> for Dr. {activeAppt.doctor_name}'s OPD queue.
            {eta?.delayReason && (
              <span className="block mt-0.5 text-amber-800 font-medium">Reason: {eta.delayReason}</span>
            )}
            <span className="block text-[11px] text-amber-700 mt-1">Your estimated consultation time has been dynamically extended.</span>
          </div>
        </div>
      )}

      {/* Queue Paused Alert Banner */}
      {isPaused && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3.5 text-rose-900 shadow-xs animate-fadeIn">
          <PauseCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm block">Consultation Queue Paused</span>
            Dr. {activeAppt.doctor_name}'s queue is temporarily paused ({eta?.delayReason || 'Doctor attending inpatient emergency'}). Queue estimates are paused until resumed.
          </div>
        </div>
      )}

      {/* Main Centerpiece Ticket Display */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-teal-800 text-white p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs uppercase font-bold tracking-wider text-teal-200">
                  Digital OPD Token
                </span>
                <QueueStatusBadge status={activeAppt.status} size="sm" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {activeAppt.hospital_name}
              </h1>
              <p className="text-teal-100 text-xs sm:text-sm mt-1">
                {activeAppt.department_name} • Dr. {activeAppt.doctor_name}
              </p>
              {activeAppt.visit_reason && (
                <p className="text-xs text-teal-200 italic mt-1">
                  Visit Reason: "{activeAppt.visit_reason}"
                </p>
              )}
            </div>

            {/* Giant Token Display */}
            <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-teal-200 block">
                Your Token Number
              </span>
              <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-wider block mt-1">
                {activeAppt.token_number}
              </span>
              <span className="text-[11px] text-teal-100 font-medium block mt-1">
                Patient: {activeAppt.patient_name}
              </span>
            </div>
          </div>
        </div>

        {/* Card Body: Live ETA & Positions Grid */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Main ETA Hero Metric */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {/* 1. Currently Serving */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
                Currently Serving
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono mt-2">
                {eta?.currentlyServingToken || 'Chamber Free'}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">In Doctor's Chamber</span>
            </div>

            {/* 2. Primary Wait Time Estimate */}
            <div className="p-6 bg-gradient-to-b from-brand-50 to-teal-50/50 rounded-3xl border border-brand-200 shadow-sm md:scale-105">
              <span className="text-xs uppercase font-bold tracking-wider text-brand-800 block">
                {isBookedOnly ? 'Projected Wait' : 'Estimated Wait Time'}
              </span>
              <div className="text-4xl sm:text-5xl font-black text-brand-900 mt-2 font-mono">
                {isServingMe ? 'Now!' : isPaused ? 'Paused' : `~${eta?.estimatedMinutes ?? 20}m`}
              </div>
              {!isServingMe && !isPaused && eta && (
                <div className="text-xs font-bold text-brand-700 mt-1.5">
                  {isBookedOnly && eta.expectedCallTime ? (
                    <span>Expected Call: {eta.expectedCallTime}</span>
                  ) : (
                    <span>Planning Range: {eta.rangeLow}–{eta.rangeHigh} mins</span>
                  )}
                </div>
              )}
            </div>

            {/* 3. Patients Ahead */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
                Patients Ahead
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono mt-2">
                {isServingMe ? '0' : eta?.patientsAhead ?? 0}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {isServingMe
                  ? 'You are currently inside'
                  : isBookedOnly
                  ? `${eta?.aheadBreakdown?.waitingInLobby ?? 0} in lobby + ${eta?.aheadBreakdown?.bookedAhead ?? 0} prior booked`
                  : 'Waiting in OPD reception'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
              <span>OPD Queue Progress</span>
              <span>
                {isServingMe
                  ? 'Consultation in Progress'
                  : isBookedOnly
                  ? 'Scheduled Booking'
                  : `${eta?.patientsAhead || 0} patients ahead in queue`}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-brand-700 rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Explainable Adaptive Engine Note */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
            <Sparkles className="w-5 h-5 text-brand-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block mb-0.5">
                Dynamic Queue Estimation Model:
              </span>
              <p className="leading-relaxed">
                {eta?.explanation || 'Wait time combines remaining time of the ongoing consultation, doctor pace (EWMA), and any operational delays.'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Queue Event Log */}
        {events && events.length > 0 && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-brand-700" />
                Live OPD Chamber Events
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Syncing live</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {events.slice(0, 4).map(evt => (
                <div
                  key={evt.id}
                  className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                    <span>{evt.message}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Patient Arrival Guidance Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-600">
        <div>
          <span className="font-bold text-slate-900 block text-sm">Need to step away or running late?</span>
          <span>You can safely monitor your token from nearby or contact OPD reception if you need to reschedule.</span>
        </div>
        <Link
          to="/appointments"
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition shrink-0"
        >
          Manage All Bookings
        </Link>
      </div>
    </div>
  );
};
