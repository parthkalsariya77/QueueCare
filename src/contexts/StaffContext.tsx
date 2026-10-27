import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api.js';
import { usePolling } from '../hooks/usePolling.js';

interface StaffContextType {
  selectedHospitalId: number;
  setSelectedHospitalId: (id: number) => void;
  selectedQueueId: number;
  setSelectedQueueId: (id: number) => void;
  overview: any;
  loading: boolean;
  refetchOverview: () => void;
  hospitals: Array<{ id: number; name: string; locality: string }>;
  queues: Array<any>;
  currentHospital: { id: number; name: string; locality: string } | undefined;
  currentQueue: any | undefined;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

function parseSavedId(key: string, fallback: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const n = Number(saved);
    return isNaN(n) || n <= 0 ? fallback : n;
  } catch {
    return fallback;
  }
}

export const StaffProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedHospitalId, setSelectedHospitalIdState] = useState<number>(() =>
    parseSavedId('queuecare_staff_hospital_id', 1)
  );

  const [selectedQueueId, setSelectedQueueIdState] = useState<number>(() =>
    parseSavedId('queuecare_staff_queue_id', 1)
  );

  // Single centralized poll of hospital overview data across all staff views (60s)
  const { data: overview, loading, refetch: refetchOverview } = usePolling<any>(
    () => api.getStaffOverview(selectedHospitalId),
    60000,
    true,
    [selectedHospitalId]
  );

  const hospitals = overview?.hospitals || [];
  const queues = overview?.queues || [];
  const currentHospital = hospitals.find((h: any) => h.id === selectedHospitalId) || hospitals[0];
  const currentQueue = queues.find((q: any) => q.queue_id === selectedQueueId) || queues[0];

  // When queues for the selected hospital load, ensure selectedQueueId is valid for this hospital
  useEffect(() => {
    if (queues.length > 0) {
      const exists = queues.some((q: any) => q.queue_id === selectedQueueId);
      if (!exists && queues[0]?.queue_id) {
        const firstQueueId = Number(queues[0].queue_id);
        setSelectedQueueIdState(firstQueueId);
        try {
          localStorage.setItem('queuecare_staff_queue_id', firstQueueId.toString());
        } catch {}
      }
    }
  }, [queues, selectedQueueId]);

  const setSelectedHospitalId = useCallback((id: number) => {
    const cleanId = Number(id) || 1;
    setSelectedHospitalIdState(cleanId);
    try {
      localStorage.setItem('queuecare_staff_hospital_id', cleanId.toString());
    } catch {}
  }, []);

  const setSelectedQueueId = useCallback((id: number) => {
    const cleanId = Number(id) || 1;
    setSelectedQueueIdState(cleanId);
    try {
      localStorage.setItem('queuecare_staff_queue_id', cleanId.toString());
    } catch {}
  }, []);

  const contextValue = useMemo(() => ({
    selectedHospitalId,
    setSelectedHospitalId,
    selectedQueueId,
    setSelectedQueueId,
    overview,
    loading,
    refetchOverview,
    hospitals,
    queues,
    currentHospital,
    currentQueue
  }), [
    selectedHospitalId,
    setSelectedHospitalId,
    selectedQueueId,
    setSelectedQueueId,
    overview,
    loading,
    refetchOverview,
    hospitals,
    queues,
    currentHospital,
    currentQueue
  ]);

  return (
    <StaffContext.Provider value={contextValue}>
      {children}
    </StaffContext.Provider>
  );
};

export function useStaff() {
  const context = useContext(StaffContext);
  if (!context) {
    throw new Error('useStaff must be used within a StaffProvider');
  }
  return context;
}
