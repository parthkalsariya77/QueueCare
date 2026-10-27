import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useToast } from '../../components/Toast.js';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Clock, 
  ChevronLeft, 
  Calendar, 
  User, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  FileText
} from 'lucide-react';
import { QueueStatusBadge } from '../../components/QueueStatusBadge.js';
import { TimeSlot } from '../../../shared/types.js';

export const HospitalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [hospital, setHospital] = useState<any>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [bookingDoctor, setBookingDoctor] = useState<any>(null);
  const [targetDateOffset, setTargetDateOffset] = useState<number>(0); // 0 = today, 1 = tomorrow, 2 = day after
  const [patientName, setPatientName] = useState('Rohan Mehta');
  const [patientPhone, setPatientPhone] = useState('+91 98250 12345');
  const [visitReason, setVisitReason] = useState('Routine consultation');

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    const hospId = Number(id);
    if (!id || isNaN(hospId) || hospId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getHospitalDetail(hospId)
      .then(res => {
        setHospital(res);
        if (res.departments && res.departments.length > 0) {
          setSelectedDeptId(res.departments[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const loadSlotsForDate = async (doctor: any, offset: number) => {
    setLoadingSlots(true);
    setSelectedSlotTime(null);
    try {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const availableSlots = await api.getDoctorSlots(doctor.id, d.toISOString());
      setSlots(availableSlots);
    } catch (err: any) {
      setBookingError('Failed to load slots: ' + err.message);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleOpenBooking = async (doctor: any) => {
    setBookingDoctor(doctor);
    setTargetDateOffset(0);
    setSelectedSlotTime(null);
    setBookingSuccess(null);
    setBookingError(null);
    await loadSlotsForDate(doctor, 0);
  };

  const handleDateChange = async (offset: number) => {
    setTargetDateOffset(offset);
    if (bookingDoctor) {
      await loadSlotsForDate(bookingDoctor, offset);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlotTime || !bookingDoctor || !hospital) return;
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const res = await api.bookAppointment({
        hospitalId: hospital.id,
        departmentId: bookingDoctor.department_id,
        doctorId: bookingDoctor.id,
        scheduledTime: selectedSlotTime,
        patientName,
        patientPhone,
        visitReason
      });
      setBookingSuccess(res);
      showToast(`Appointment confirmed! Token ${res.token_number} issued.`, 'success');
    } catch (err: any) {
      setBookingError(err.message || 'Failed to book appointment');
      showToast('Booking failed: ' + err.message, 'error');
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
        Loading hospital profile and doctor rosters...
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Hospital not found</h3>
        <Link to="/hospitals" className="text-brand-700 font-bold hover:underline text-xs">
          Return to Hospital Search
        </Link>
      </div>
    );
  }

  const currentDept = hospital.departments?.find((d: any) => d.id === selectedDeptId);

  const getTargetDateLabel = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (offset === 0) return 'Today (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
    if (offset === 1) return 'Tomorrow (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back button */}
      <div>
        <Link
          to="/hospitals"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Hospital Search
        </Link>
      </div>

      {/* Hospital Hero Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-800 font-bold text-xs mb-2 border border-brand-200">
            <Building2 className="w-3.5 h-3.5" />
            <span>OPD Hours: {hospital.open_time} - {hospital.close_time}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {hospital.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-600" />
            {hospital.locality}, {hospital.city}
            <span className="text-slate-300">•</span>
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            {hospital.phone}
          </p>
          <p className="text-xs text-slate-600 mt-3 max-w-2xl leading-relaxed">
            {hospital.description}
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 max-w-xs shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
            <Sparkles className="w-4 h-4 text-brand-700" />
            <span>Smart Queue Estimation</span>
          </div>
          Real-time waiting times adjust dynamically based on actual consultation pace and doctor workload.
        </div>
      </div>

      {/* Department Tabs */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Specialty Clinics & Departments
        </h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {hospital.departments?.map((dept: any) => (
            <button
              key={dept.id}
              onClick={() => setSelectedDeptId(dept.id)}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all shadow-xs ${
                selectedDeptId === dept.id
                  ? 'bg-brand-700 text-white shadow-brand-700/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {dept.name}
            </button>
          ))}
        </div>
      </div>

      {/* Doctors in Selected Department */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Doctors on Duty in {currentDept?.name}
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {currentDept?.doctors?.length || 0} doctors available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentDept?.doctors?.map((doc: any) => (
            <div
              key={doc.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-brand-300 transition shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-base shrink-0">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{doc.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{doc.specialization}</p>
                    </div>
                  </div>

                  <QueueStatusBadge status={doc.queue_status || 'active'} size="sm" />
                </div>

                {/* Queue Stats Row */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-center p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">In Queue</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {doc.waitingCount} waiting
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Estimated OPD Wait</span>
                    <span className="font-bold text-brand-700 text-sm flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      ~{doc.currentWaitMinutes} mins
                    </span>
                  </div>
                </div>

                {doc.currentlyServingToken && (
                  <p className="text-[11px] text-emerald-700 mt-2.5 flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 live-pulse"></span>
                    Currently serving Token: <strong>{doc.currentlyServingToken}</strong>
                  </p>
                )}

                {doc.delay_minutes > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Operational Delay: +{doc.delay_minutes}m ({doc.delay_reason})
                  </p>
                )}
              </div>

              {/* Action */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Learned Pace: ~{doc.predictedAvgMinutes}m / patient
                </span>
                <button
                  onClick={() => handleOpenBooking(doc)}
                  className="px-5 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs transition shadow-xs"
                >
                  Book Appointment
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enhanced Booking Modal */}
      {bookingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-brand-900 text-white flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-300 block">
                  Book Outpatient Consultation
                </span>
                <h3 className="text-lg font-bold mt-0.5">{bookingDoctor.name}</h3>
                <p className="text-xs text-teal-100">{hospital.name} • {currentDept?.name}</p>
              </div>
              <button
                onClick={() => setBookingDoctor(null)}
                className="text-white/70 hover:text-white p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {bookingSuccess ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Appointment Confirmed!</h4>
                    <p className="text-xs text-slate-500 mt-1">Your digital consultation token has been issued.</p>
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 inline-block w-full text-center">
                    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Your Digital Token</div>
                    <div className="text-4xl font-extrabold text-brand-700 font-mono mt-1">
                      {bookingSuccess.token_number}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 mt-2">
                      Scheduled Slot: {new Date(bookingSuccess.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Patient: {bookingSuccess.patient_name}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                    <Link
                      to={`/tracker?appointmentId=${bookingSuccess.id}`}
                      className="px-5 py-2.5 rounded-xl bg-brand-700 text-white font-bold text-xs shadow hover:bg-brand-800 transition flex items-center justify-center gap-1.5"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Live Track in Queue</span>
                    </Link>
                    <button
                      onClick={() => {
                        setBookingDoctor(null);
                        navigate('/appointments');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
                    >
                      View All My Bookings
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Step 1: Select Date */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">
                      1. Select Consultation Date:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map(offset => (
                        <button
                          key={offset}
                          type="button"
                          onClick={() => handleDateChange(offset)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center ${
                            targetDateOffset === offset
                              ? 'bg-brand-700 text-white border-brand-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {getTargetDateLabel(offset)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Patient Details */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block">
                      2. Patient Details:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block mb-1">Patient Name:</span>
                        <input
                          type="text"
                          value={patientName}
                          onChange={e => setPatientName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-600"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block mb-1">Contact Phone:</span>
                        <input
                          type="text"
                          value={patientPhone}
                          onChange={e => setPatientPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-600"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-medium block mb-1">Reason for Visit / Symptoms:</span>
                      <input
                        type="text"
                        value={visitReason}
                        onChange={e => setVisitReason(e.target.value)}
                        placeholder="e.g. Fever checkup, chest pain, routine follow-up"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-600"
                      />
                    </div>
                  </div>

                  {/* Step 3: Choose Time Slot */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        3. Select Available Slot:
                      </label>
                      <span className="text-[11px] text-slate-400">30-min OPD consultations</span>
                    </div>

                    {loadingSlots ? (
                      <div className="p-6 text-center text-xs text-slate-400">Loading slots...</div>
                    ) : slots.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No slots available for this date.</div>
                    ) : (
                      <div className="space-y-3">
                        {/* Morning Session */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-brand-600" />
                            <span>Morning Session (09:00 AM – 01:00 PM)</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {slots.filter(s => s.session === 'morning').map(slot => (
                              <button
                                key={slot.time}
                                disabled={!slot.isAvailable}
                                onClick={() => setSelectedSlotTime(slot.time)}
                                className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                                  !slot.isAvailable
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                    : selectedSlotTime === slot.time
                                    ? 'bg-brand-700 text-white border-brand-700 shadow-md ring-2 ring-brand-400'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-brand-500 hover:bg-slate-50'
                                }`}
                              >
                                <span className={!slot.isAvailable ? 'line-through' : ''}>{slot.slotLabel}</span>
                                {slot.isBooked && (
                                  <span className="text-[9px] uppercase font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded leading-none">Booked</span>
                                )}
                                {slot.isPast && (
                                  <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-200 px-1 py-0.5 rounded leading-none">Passed</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Afternoon / Evening Session */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-teal-600" />
                            <span>Afternoon Session (02:00 PM – 06:00 PM)</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {slots.filter(s => s.session === 'afternoon').map(slot => (
                              <button
                                key={slot.time}
                                disabled={!slot.isAvailable}
                                onClick={() => setSelectedSlotTime(slot.time)}
                                className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center gap-0.5 ${
                                  !slot.isAvailable
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                    : selectedSlotTime === slot.time
                                    ? 'bg-brand-700 text-white border-brand-700 shadow-md ring-2 ring-brand-400'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-brand-500 hover:bg-slate-50'
                                }`}
                              >
                                <span className={!slot.isAvailable ? 'line-through' : ''}>{slot.slotLabel}</span>
                                {slot.isBooked && (
                                  <span className="text-[9px] uppercase font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded leading-none">Booked</span>
                                )}
                                {slot.isPast && (
                                  <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-200 px-1 py-0.5 rounded leading-none">Passed</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedSlotTime && (
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>
                        Selected: <strong>{new Date(selectedSlotTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> on {getTargetDateLabel(targetDateOffset)}
                      </span>
                    </div>
                  )}

                  {bookingError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{bookingError}</span>
                    </div>
                  )}

                  {/* Bottom Actions */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setBookingDoctor(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedSlotTime || bookingSubmitting}
                      onClick={handleConfirmBooking}
                      className="px-5 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white text-xs font-bold shadow transition"
                    >
                      {bookingSubmitting ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
