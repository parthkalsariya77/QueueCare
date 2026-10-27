import React from 'react';
import { Link } from 'react-router-dom';
import { useStaff } from '../../contexts/StaffContext.js';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../lib/api.js';
import { QueueStatusBadge } from '../../components/QueueStatusBadge.js';
import { useToast } from '../../components/Toast.js';
import { 
  Building2, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw,
  ArrowRight,
  Activity,
  UserCheck,
  RefreshCw
} from 'lucide-react';

export const StaffOverview: React.FC = () => {
  const {
    selectedHospitalId,
    setSelectedHospitalId,
    selectedQueueId,
    setSelectedQueueId,
    overview,
    loading,
    refetchOverview,
    hospitals,
    queues,
    currentQueue
  } = useStaff();
  const { showToast } = useToast();

  // Poll entries for currently selected queue, immediately re-fetching when selectedQueueId changes
  const { data: entries, refetch: refetchEntries } = usePolling<any[]>(
    () => api.getQueueEntries(selectedQueueId),
    60000,
    Boolean(selectedQueueId),
    [selectedQueueId]
  );

  const selectedQueue = currentQueue;

  const handleStartConsultation = async () => {
    try {
      const appt = await api.startConsultation(selectedQueueId);
      showToast(`Called Token ${appt.token_number} (${appt.patient_name}) into consultation!`, 'success');
      refetchOverview();
      refetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-teal-300 font-mono text-[11px] mb-2">
            <span>Hospital Staff Control Room</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            OPD Queue Management Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time control console. Actions performed here directly update patient tokens and adaptive waiting times.
          </p>
        </div>

        {/* Hospital Selector & Manual Sync */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { refetchOverview(); refetchEntries(); }}
            className="px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            title="Sync staff console"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-600" />
            <span>Sync</span>
          </button>

          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <Building2 className="w-4 h-4 text-brand-700 ml-2" />
            <select
              value={selectedHospitalId}
              onChange={e => {
                const newHospId = Number(e.target.value);
                setSelectedHospitalId(newHospId);
              }}
              className="text-xs font-bold text-slate-800 bg-transparent border-none pr-8 cursor-pointer focus:ring-0"
            >
              {hospitals.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.locality})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Hospital KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Waiting in OPD</span>
            <div className="text-3xl font-extrabold text-amber-600 font-mono mt-1">
              {overview?.stats?.waiting ?? 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Checked-in patients</span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">In Consultation</span>
            <div className="text-3xl font-extrabold text-emerald-600 font-mono mt-1">
              {overview?.stats?.inConsultation ?? 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Currently with doctors</span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Completed Today</span>
            <div className="text-3xl font-extrabold text-brand-700 font-mono mt-1">
              {overview?.stats?.completed ?? 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Recorded in ETA history</span>
          </div>
          <div className="w-12 h-12 bg-brand-50 text-brand-700 rounded-2xl flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Doctor Queue Selection Bar */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Select Doctor Queue to Inspect & Operate
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {queues?.map((q: any) => (
            <button
              key={q.queue_id}
              onClick={() => setSelectedQueueId(q.queue_id)}
              className={`p-4 rounded-2xl text-left border transition shadow-sm flex flex-col justify-between ${
                selectedQueueId === q.queue_id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-brand-500'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-brand-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${selectedQueueId === q.queue_id ? 'text-teal-300' : 'text-brand-700'}`}>
                    {q.department_name}
                  </span>
                  <QueueStatusBadge status={q.status} size="sm" />
                </div>
                <h4 className="font-bold text-sm mt-1">{q.doctor_name}</h4>
                <p className={`text-[11px] mt-0.5 line-clamp-1 ${selectedQueueId === q.queue_id ? 'text-slate-300' : 'text-slate-500'}`}>
                  {q.specialization}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100/20 flex items-center justify-between text-xs font-mono">
                <span>Waiting: {q.waiting_count}</span>
                <span>Serving: {q.serving_token || 'None'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Queue Operations Preview */}
      {selectedQueue && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedQueue.doctor_name}'s Active Queue
                </h3>
                <QueueStatusBadge status={selectedQueue.status} size="sm" />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selectedQueue.department_name} • {selectedQueue.waiting_count} patients waiting
                {selectedQueue.delay_minutes > 0 && ` • +${selectedQueue.delay_minutes}m delay active`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/staff/operations"
                className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
              >
                <span>Full Operations Console</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Quick Active Entries Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Token</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Scheduled Slot</th>
                  <th className="py-3 px-4">Queue Position</th>
                  <th className="py-3 px-4 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries && entries.length > 0 ? (
                  entries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-brand-800 text-sm">
                        {entry.token_number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {entry.patient_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(entry.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {entry.status === 'in_consultation' ? (
                          <span className="text-emerald-700 font-bold">Serving Now</span>
                        ) : entry.queue_position ? (
                          `#${entry.queue_position}`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <QueueStatusBadge status={entry.status} size="sm" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No active entries in this doctor's queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
