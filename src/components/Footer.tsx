import React from 'react';
import { ShieldCheck, Heart, Clock } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16 py-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-brand-700 shrink-0" />
            <p className="text-slate-600">
              <strong className="text-slate-800">QueueCare Health System:</strong> Dynamic waiting times are computed using adaptive exponential models based on clinical pace and operational schedules.
            </p>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span>© 2026 QueueCare Technologies. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
