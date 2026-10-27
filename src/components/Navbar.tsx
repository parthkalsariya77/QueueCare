import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext.js';
import { 
  Building2, 
  Calendar, 
  Clock, 
  LayoutDashboard, 
  Users, 
  Activity, 
  ArrowRightLeft, 
  RotateCcw,
  Sparkles,
  PhoneCall,
  ShieldCheck
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.js';
import { ConfirmModal } from './ConfirmModal.js';

export const Navbar: React.FC = () => {
  const { role, toggleRole } = useRole();
  const location = useLocation();
  const { showToast } = useToast();
  const [showResetModal, setShowResetModal] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleReset = async () => {
    try {
      await api.resetDemo();
      setShowResetModal(false);
      showToast('System data successfully reset to clean baseline!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast('Failed to reset: ' + err.message, 'error');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        {/* Top Professional Utility Bar */}
        <div className="bg-slate-900 text-slate-300 text-xs px-4 sm:px-8 py-1.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 live-pulse"></span>
            <span className="font-semibold text-white tracking-wide">QueueCare Health System</span>
            <span className="hidden sm:inline text-slate-400">• OPD Network Ahmedabad & Gandhinagar</span>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-teal-300 font-medium">
              <PhoneCall className="w-3 h-3 text-teal-400" />
              <span>OPD Helpline: 1800-419-CARE</span>
            </div>

            {/* If in staff mode, show System Reset utility */}
            {role === 'staff' && (
              <button
                onClick={() => setShowResetModal(true)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                title="Reset database to initial clean records"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset System Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={role === 'patient' ? '/' : '/staff'} className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-brand-700/20 group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl text-slate-900 tracking-tight">QueueCare</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                    Health Portal
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Smart Outpatient Queue & Consultation Network</p>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5">
              {role === 'patient' ? (
                <>
                  <Link
                    to="/"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isActive('/') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>

                  <Link
                    to="/hospitals"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isActive('/hospitals') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Find Hospitals & Doctors
                  </Link>

                  <Link
                    to="/appointments"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isActive('/appointments') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    My Appointments
                  </Link>

                  <Link
                    to="/tracker"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isActive('/tracker') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 live-pulse"></span>
                    Live Queue Tracker
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/staff"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isActive('/staff') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Staff Overview
                  </Link>

                  <Link
                    to="/staff/operations"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isActive('/staff/operations') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Queue Console
                  </Link>

                  <Link
                    to="/staff/insights"
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      isActive('/staff/insights') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Statistical Governance
                  </Link>
                </>
              )}
            </nav>

            {/* Portal Switcher */}
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => role !== 'patient' && toggleRole()}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    role === 'patient'
                      ? 'bg-white text-brand-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Patient Portal
                </button>
                <button
                  type="button"
                  onClick={() => role !== 'staff' && toggleRole()}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    role === 'staff'
                      ? 'bg-slate-900 text-teal-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Staff Console
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 py-2.5 px-2 bg-slate-50 text-xs font-medium">
          {role === 'patient' ? (
            <>
              <Link to="/" className={`p-1.5 rounded ${isActive('/') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}>
                Dashboard
              </Link>
              <Link to="/hospitals" className={`p-1.5 rounded ${isActive('/hospitals') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}>
                Hospitals
              </Link>
              <Link to="/appointments" className={`p-1.5 rounded ${isActive('/appointments') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}>
                Appointments
              </Link>
              <Link to="/tracker" className={`p-1.5 rounded ${isActive('/tracker') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}>
                Queue Tracker
              </Link>
            </>
          ) : (
            <>
              <Link to="/staff" className={`p-1.5 rounded ${isActive('/staff') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}>
                Overview
              </Link>
              <Link to="/staff/operations" className={`p-1.5 rounded ${isActive('/staff/operations') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}>
                Operations
              </Link>
              <Link to="/staff/insights" className={`p-1.5 rounded ${isActive('/staff/insights') ? 'text-brand-700 font-bold' : 'text-slate-600'}`}>
                Governance
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        title="Reset System Data?"
        message="This will restore all hospital schedules, doctor queues, and patient records to their initial clean state."
        confirmText="Reset Baseline Data"
        isDestructive={true}
        onConfirm={handleReset}
        onCancel={() => setShowResetModal(false)}
      />
    </>
  );
};
