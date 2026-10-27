import React from 'react';
import { AppointmentStatus, QueueStatus } from '../../shared/types.js';

interface Props {
  status: AppointmentStatus | QueueStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const QueueStatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  }[size];

  switch (status) {
    case 'in_consultation':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 live-pulse"></span>
          In Consultation
        </span>
      );
    case 'waiting':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          In Queue (Waiting)
        </span>
      );
    case 'booked':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Booked (Not Checked In)
        </span>
      );
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          Completed
        </span>
      );
    case 'paused':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Queue Paused
        </span>
      );
    case 'active':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 ${sizeClasses}`}>
          Active
        </span>
      );
    case 'cancelled':
      return (
        <span className={`inline-flex items-center rounded-full bg-gray-100 text-gray-600 border border-gray-200 ${sizeClasses}`}>
          Cancelled
        </span>
      );
    case 'no_show':
      return (
        <span className={`inline-flex items-center rounded-full bg-orange-100 text-orange-800 border border-orange-200 ${sizeClasses}`}>
          No Show
        </span>
      );
    case 'rescheduled':
      return (
        <span className={`inline-flex items-center rounded-full bg-purple-100 text-purple-800 border border-purple-200 ${sizeClasses}`}>
          Rescheduled
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-800 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};
