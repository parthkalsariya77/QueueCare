import React, { useState } from 'react';
import { useStaff } from '../../contexts/StaffContext.js';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../lib/api.js';
import { QueueStatusBadge } from '../../components/QueueStatusBadge.js';
import { useToast } from '../../components/Toast.js';
import { 
  Building2, 
  Users, 
  Clock, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Pause, 
  UserX, 
  CalendarClock, 
  Sparkles,
  Info,
  RefreshCw
} from 'lucide-react';

export const QueueOperations: React.FC = () => {
  const {
    selectedHospitalId,
    setSelectedHospitalId,
    selectedQueueId,
    setSelectedQueueId,
    refetchOverview,
    hospitals,
    queues,
    currentQueue
  } = useStaff();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [queueRosterTab, setQueueRosterTab] = useState<'waiting' | 'booked' | 'all'>('waiting');
  const { showToast } = useToast();

  // Modal / Inputs state
  const [durationPickerAppt, setDurationPickerAppt] = useState<any>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(8);

  const [delayInput, setDelayInput] = useState<number>(10);
  const [delayReason, setDelayReason] = useState<string>('Consultation running longer than expected');
  const [showDelayModal, setShowDelayModal] = useState<boolean>(false);

  // Poll entries for selected queue, immediately re-fetching when selectedQueueId changes
  const { data: entries, refetch: refetchEntries } = usePolling<any[]>(
    () => api.getQueueEntries(selectedQueueId),
    60000,
    Boolean(selectedQueueId),
    [selectedQueueId]
  );

  const selectedQueue = currentQueue;
  const activeServing = entries?.find((e: any) => e.status === 'in_consultation');
  const waitingPatients = entries?.filter((e: any) => e.status === 'waiting') || [];
  const bookedPatients = entries?.filter((e: any) => e.status === 'booked') || [];

  const flashMessage = (msg: string) => {
    setActionMessage(msg);
    showToast(msg, 'success');
    setTimeout(() => setActionMessage(null), 4000);
  };

  // 1. Call Next Patient
  const handleCallNext = async () => {
    try {
      const res = await api.startConsultation(selectedQueueId);
      flashMessage(`Called Token ${res.token_number} (${res.patient_name}) into consultation!`);
      refetchOverview();
      refetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // 2. Complete Consultation
  const handleCompleteConsultation = async () => {
    if (!durationPickerAppt) return;
    try {
      await api.completeConsultation(durationPickerAppt.id, selectedDuration);
      setDurationPickerAppt(null);
      flashMessage(`Consultation completed! Recorded duration of ${selectedDuration}m to update adaptive EWMA.`);
      refetchOverview();
      refetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // 3. Set Delay
  const handleSaveDelay = async (minutes: number, reason: string) => {
    try {
      await api.setDelay(selectedQueueId, minutes, reason);
      setShowDelayModal(false);
      flashMessage(minutes > 0 ? `Set +${minutes}m queue delay: "${reason}"` : 'Queue delay cleared.');
      refetchOverview();
      refetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // 4. Toggle Pause
  const handleTogglePause = async () => {
    if (!selectedQueue) return;
    const newStatus = selectedQueue.status === 'active' ? 'paused' : 'active';
    try {
      await api.togglePause(selectedQueueId, newStatus, newStatus === 'paused' ? 'Staff paused queue for ward round' : undefined);
      flashMessage(`Queue status updated to ${newStatus}.`);
      refetchOverview();
      refetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // 5. Mark No Show
  const handleMarkNoShow = async (appointmentId: number, token: string) => {
    try {
      await api.markNoShow(appointmentId);
      flashMessage(`Token ${token} marked as No-Show.`);
      refetchOverview();
      refetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // 6. Reception Check-In
  const handleCheckIn = async (appointmentId: number, token: string) => {
    try {
      await api.checkInAppointment(appointmentId);
      flashMessage(`Checked in Token ${token} at the reception.`);
      refetchOverview();
      refetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Queue Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Queue Operations Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time OPD triage, token calling, duration feedback, and operational delay controls.
          </p>
        </div>

        {/* Controls: Hospital Selector + Doctor Queue Selector + Manual Sync */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => { refetchOverview(); refetchEntries(); }}
            className="px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            title="Sync queue operations"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-600" />
            <span>Sync</span>
          </button>

          {/* Hospital Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <Building2 className="w-4 h-4 text-brand-700" />
            <select
              value={selectedHospitalId}
              onChange={e => setSelectedHospitalId(Number(e.target.value))}
              className="text-xs font-bold text-slate-800 bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              {hospitals.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Queue Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500">Doctor:</span>
            <select
              value={selectedQueueId}
              onChange={e => setSelectedQueueId(Number(e.target.value))}
              className="text-xs font-bold text-slate-800 bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              {queues.map((q: any) => (
                <option key={q.queue_id} value={q.queue_id}>
                  Dr. {q.doctor_name} ({q.department_name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="bg-brand-900 text-teal-200 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-lg shadow-brand-900/10 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
          <span className="text-[10px] text-teal-400">Synced to patient portal</span>
        </div>
      )}

      {/* Operational Controls Action Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          {/* Active Doctor Info */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                Dr. {selectedQueue?.doctor_name}
              </h2>
              <QueueStatusBadge status={selectedQueue?.status || 'active'} size="sm" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedQueue?.department_name} • {waitingPatients.length} waiting in line
              {selectedQueue?.delay_minutes > 0 && (
                <span className="text-amber-700 font-bold ml-2">
                  (+{selectedQueue.delay_minutes}m delay: {selectedQueue.delay_reason})
                </span>
              )}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Call Next Patient */}
            <button
              onClick={handleCallNext}
              disabled={Boolean(activeServing) || waitingPatients.length === 0}
              className="px-4 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition flex items-center gap-2"
              title={activeServing ? 'Complete current consultation first' : 'Call next waiting patient'}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Call Next Patient</span>
            </button>

            {/* Complete Current (if any) */}
            {activeServing && (
              <button
                onClick={() => {
                  setDurationPickerAppt(activeServing);
                  setSelectedDuration(8);
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 animate-bounce"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete Token {activeServing.token_number}</span>
              </button>
            )}

            {/* Delay Button */}
            <button
              onClick={() => setShowDelayModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200 transition flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>{selectedQueue?.delay_minutes > 0 ? `Adjust Delay (+${selectedQueue.delay_minutes}m)` : 'Add Delay'}</span>
            </button>

            {/* Pause / Resume Button */}
            <button
              onClick={handleTogglePause}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition flex items-center gap-1.5 ${
                selectedQueue?.status === 'paused'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
              }`}
            >
              {selectedQueue?.status === 'paused' ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Queue</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Queue</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Currently Serving Hero Area */}
        {activeServing ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 live-pulse shrink-0"></span>
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                  Currently In Doctor's Chamber
                </div>
                <div className="text-xl font-black text-emerald-950 font-mono mt-0.5">
                  Token {activeServing.token_number} • {activeServing.patient_name}
                </div>
                <div className="text-xs text-emerald-700 mt-0.5">
                  Consultation started at {new Date(activeServing.consultation_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setDurationPickerAppt(activeServing);
                setSelectedDuration(8);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition shrink-0"
            >
              Complete Consultation & Log Duration
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-center justify-between">
            <span>Doctor's chamber is currently free. Click <strong>"Call Next Patient"</strong> to invite the next token.</span>
            <span className="text-[10px] text-slate-400 font-mono">Idle</span>
          </div>
        )}

        {/* Queue Entries Table */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQueueRosterTab('waiting')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                  queueRosterTab === 'waiting'
                    ? 'bg-brand-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Waiting in Lobby ({waitingPatients.length})
              </button>
              <button
                onClick={() => setQueueRosterTab('booked')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                  queueRosterTab === 'booked'
                    ? 'bg-brand-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Scheduled Today ({bookedPatients.length})
              </button>
              <button
                onClick={() => setQueueRosterTab('all')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                  queueRosterTab === 'all'
                    ? 'bg-brand-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Active ({entries?.length || 0})
              </button>
            </div>

            <span className="text-slate-400 text-[11px] font-normal">Real-time database state</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4">Token</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Reason / Complaint</th>
                  <th className="py-3 px-4">Scheduled Slot</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries && entries.length > 0 ? (
                  entries
                    .filter((appt: any) => {
                      if (queueRosterTab === 'waiting') return appt.status === 'waiting' || appt.status === 'in_consultation';
                      if (queueRosterTab === 'booked') return appt.status === 'booked';
                      return true;
                    })
                    .map((appt: any) => (
                    <tr
                      key={appt.id}
                      className={`hover:bg-slate-50/80 transition ${
                        appt.status === 'in_consultation' ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                        {appt.status === 'in_consultation' ? (
                          <span className="text-emerald-700 font-extrabold">★ In Chamber</span>
                        ) : appt.queue_position ? (
                          `#${appt.queue_position}`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-brand-800 text-sm">
                        {appt.token_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{appt.patient_name}</div>
                        {appt.patient_phone && (
                          <div className="text-[10px] text-slate-400 font-normal">{appt.patient_phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-[160px] truncate">
                        {appt.visit_reason || 'Routine consultation'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {new Date(appt.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <QueueStatusBadge status={appt.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {appt.status === 'booked' && (
                          <button
                            onClick={() => handleCheckIn(appt.id, appt.token_number)}
                            className="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-[11px] transition"
                          >
                            Reception Check-in
                          </button>
                        )}

                        {appt.status === 'waiting' && (
                          <button
                            onClick={() => handleMarkNoShow(appt.id, appt.token_number)}
                            className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold text-[11px] transition border border-rose-100"
                            title="Skip token if patient is absent"
                          >
                            Mark No-Show
                          </button>
                        )}

                        {appt.status === 'in_consultation' && (
                          <button
                            onClick={() => {
                              setDurationPickerAppt(appt);
                              setSelectedDuration(8);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition"
                          >
                            Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No patients in this queue view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Complete Consultation Duration Picker Modal */}
      {durationPickerAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-emerald-700 text-white">
              <h3 className="text-base font-bold">Complete Consultation</h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Token {durationPickerAppt.token_number} • {durationPickerAppt.patient_name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600">
                Select simulated duration for this consultation. This updates the historical duration dataset and refines the doctor's adaptive EWMA waiting time estimate:
              </div>

              {/* Quick Duration Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[4, 6, 8, 10].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSelectedDuration(mins)}
                    className={`py-3 rounded-xl text-center text-xs font-bold border transition ${
                      selectedDuration === mins
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-md'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                    }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>

              {/* Custom Duration Input */}
              <div className="pt-2">
                <label className="text-[11px] text-slate-500 font-semibold block mb-1">
                  Or enter custom duration (minutes):
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={selectedDuration}
                  onChange={e => setSelectedDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
                <span>
                  Will log <strong>{selectedDuration} minutes</strong> to Dr. {selectedQueue?.doctor_name}'s history.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDurationPickerAppt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCompleteConsultation}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow"
                >
                  Complete & Update Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Adjust Delay Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white">
              <h3 className="text-base font-bold">Manage OPD Queue Delay</h3>
              <p className="text-xs text-slate-300 mt-0.5">Dr. {selectedQueue?.doctor_name}'s Queue</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600">
                Add an operational delay to announce schedule shifts and update waiting patients' estimated times:
              </div>

              {/* Quick delay amount chips */}
              <div className="grid grid-cols-4 gap-2">
                {[0, 5, 10, 15].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDelayInput(m)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      delayInput === m
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'
                    }`}
                  >
                    {m === 0 ? 'Clear (0m)' : `+${m} mins`}
                  </button>
                ))}
              </div>

              {/* Reason selection */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Reason for Delay (visible to patients):
                </label>
                <select
                  value={delayReason}
                  onChange={e => setDelayReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Consultation running longer than expected">Consultation running longer than expected</option>
                  <option value="Doctor attending emergency inpatient ECG">Doctor attending emergency inpatient ECG</option>
                  <option value="Doctor delayed due to ward rounds">Doctor delayed due to ward rounds</option>
                  <option value="Temporary operational / diagnostic delay">Temporary operational / diagnostic delay</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDelayModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDelay(delayInput, delayReason)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow"
                >
                  Apply Delay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
