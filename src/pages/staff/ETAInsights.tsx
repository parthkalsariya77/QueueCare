import React from 'react';
import { useStaff } from '../../contexts/StaffContext.js';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../lib/api.js';
import { ETAInsights } from '../../../shared/types.js';
import { 
  Building2,
  Activity, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  Info, 
  CheckCircle2, 
  ShieldCheck,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export const StaffETAInsights: React.FC = () => {
  const {
    selectedHospitalId,
    setSelectedHospitalId,
    selectedQueueId,
    setSelectedQueueId,
    refetchOverview,
    hospitals,
    queues
  } = useStaff();

  // Poll insights for selected queue, immediately re-fetching when selectedQueueId changes
  const { data: insights, loading, refetch: refetchInsights } = usePolling<ETAInsights>(
    () => api.getQueueInsights(selectedQueueId),
    60000,
    Boolean(selectedQueueId),
    [selectedQueueId]
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 font-mono text-[11px] mb-2 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Statistical Model Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Clinical Pace Analytics & ETA Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Compare the Adaptive Exponentially Weighted Moving Average (EWMA) model with static department benchmarks.
          </p>
        </div>

        {/* Controls: Hospital Selector + Doctor Queue selector + Manual Sync */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => { refetchOverview(); refetchInsights(); }}
            className="px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            title="Sync insights model"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-600" />
            <span>Sync</span>
          </button>

          {/* Hospital Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-xs">
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
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-xs">
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

      {loading && !insights ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          Calculating statistical pace and variance parameters...
        </div>
      ) : insights ? (
        <>
          {/* Side-by-Side Model Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Adaptive EWMA (QueueCare Engine) */}
            <div className="bg-gradient-to-br from-brand-900 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-teal-400/20 text-teal-300 font-mono text-xs font-bold uppercase tracking-wider border border-teal-400/30">
                  Adaptive EWMA Estimator
                </span>
                <span className="text-xs text-teal-200 font-medium">α = 0.30 Dynamic Recency</span>
              </div>

              <div className="mt-6">
                <span className="text-xs text-teal-200 uppercase font-bold tracking-wider block">
                  Adaptive Total Queue Wait
                </span>
                <div className="text-5xl font-black font-mono text-white mt-1">
                  ~{insights.adaptiveETA} mins
                </div>
                <p className="text-xs text-teal-100 mt-2 leading-relaxed">
                  Derived from Dr. {insights.doctorName}'s weighted consultation pace of{' '}
                  <strong>{insights.blendedDuration} mins / patient</strong> across{' '}
                  {insights.waitingCount + insights.inConsultationCount} active queue entries.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <span className="text-[10px] text-teal-300 block">Doctor EWMA</span>
                  <span className="font-bold text-white text-sm font-mono mt-0.5 block">{insights.doctorEWMA}m</span>
                </div>
                <div>
                  <span className="text-[10px] text-teal-300 block">Sample Observations</span>
                  <span className="font-bold text-white text-sm font-mono mt-0.5 block">{insights.sampleCount} pts</span>
                </div>
                <div>
                  <span className="text-[10px] text-teal-300 block">Staff Delay</span>
                  <span className="font-bold text-white text-sm font-mono mt-0.5 block">+{insights.activeDelayMinutes}m</span>
                </div>
              </div>
            </div>

            {/* Card 2: Baseline Fixed Model */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-bold uppercase tracking-wider">
                    Static Department Baseline
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Fixed Benchmark</span>
                </div>

                <div className="mt-6">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block">
                    Fixed Department Baseline Wait
                  </span>
                  <div className="text-5xl font-black font-mono text-slate-800 mt-1">
                    ~{insights.baselineETA} mins
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Uses static {insights.departmentName} historical median duration of{' '}
                    <strong>{insights.departmentMedian} mins</strong> multiplied by queue length, without doctor pace adaptation.
                  </p>
                </div>
              </div>

              {/* Difference callout */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Model Variance:</span>
                <span className={`font-bold px-2.5 py-1 rounded-lg ${
                  insights.adaptiveETA !== insights.baselineETA
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {insights.adaptiveETA > insights.baselineETA
                    ? `+${insights.adaptiveETA - insights.baselineETA}m longer than baseline`
                    : insights.adaptiveETA < insights.baselineETA
                    ? `${insights.baselineETA - insights.adaptiveETA}m faster than baseline`
                    : 'Identical to baseline'}
                </span>
              </div>
            </div>
          </div>

          {/* Narrative Interpretation Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-700" />
              Real-Time Model Interpretation
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {insights.explanation}
            </p>
          </div>

          {/* Recent Consultation Observations Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Recent Consultation Duration Observations
                </h3>
                <p className="text-xs text-slate-500">
                  Recorded clinical durations (in minutes) logged for Dr. {insights.doctorName}
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-xl font-bold">
                {insights.sampleCount} total records in database
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2">
              {insights.recentDurations.map((dur, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center"
                >
                  <span className="text-[10px] text-slate-400 block font-semibold">Pt #{idx + 1}</span>
                  <span className="font-bold font-mono text-sm text-brand-800 mt-0.5 block">
                    {dur}m
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Statistical Methodology & Governance Card */}
          <div className="bg-slate-900 text-slate-200 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 text-teal-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Statistical Methodology & Mathematical Governance</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
              <div className="space-y-1.5">
                <strong className="text-white block font-semibold">1. Exponential Recency Weighting (α = 0.30)</strong>
                <p className="leading-relaxed text-slate-400">
                  Consultation durations exhibit natural non-stationarity due to changing patient complexity and physician schedule pace. The EWMA formulation weights the most recent clinical completion at 30%, smoothly factoring in recent shifts while preserving historical stability.
                </p>
              </div>

              <div className="space-y-1.5">
                <strong className="text-white block font-semibold">2. Bayesian Smoothing with Department Median</strong>
                <p className="leading-relaxed text-slate-400">
                  To prevent erratic variance when doctor observation count (n) is small, estimates are smoothed against the broader specialty benchmark using weight <code className="text-teal-300 font-mono">n / (n + 5)</code>, guaranteeing robust stability from day one.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
