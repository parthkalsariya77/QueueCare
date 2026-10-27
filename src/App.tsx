import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { PatientDashboard } from './pages/patient/Dashboard.js';
import { HospitalSearch } from './pages/patient/HospitalSearch.js';
import { HospitalDetail } from './pages/patient/HospitalDetail.js';
import { PatientAppointments } from './pages/patient/Appointments.js';
import { QueueTracker } from './pages/patient/QueueTracker.js';
import { StaffOverview } from './pages/staff/StaffOverview.js';
import { QueueOperations } from './pages/staff/QueueOperations.js';
import { StaffETAInsights } from './pages/staff/ETAInsights.js';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-brand-100 selection:text-brand-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Routes>
          {/* Patient Portal Routes */}
          <Route path="/" element={<PatientDashboard />} />
          <Route path="/hospitals" element={<HospitalSearch />} />
          <Route path="/hospitals/:id" element={<HospitalDetail />} />
          <Route path="/appointments" element={<PatientAppointments />} />
          <Route path="/tracker" element={<QueueTracker />} />

          {/* Hospital Staff Portal Routes */}
          <Route path="/staff" element={<StaffOverview />} />
          <Route path="/staff/operations" element={<QueueOperations />} />
          <Route path="/staff/insights" element={<StaffETAInsights />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};
