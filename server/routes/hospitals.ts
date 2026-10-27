import { Router } from 'express';
import { HospitalService } from '../services/hospital.service.js';
import { db } from '../db/connection.js';

export const hospitalRouter = Router();

// GET /api/hospitals - Search and filter
hospitalRouter.get('/', (req, res) => {
  try {
    const { q, department, locality, openOnly, maxWait, sort } = req.query;
    const results = HospitalService.searchHospitals({
      keyword: q as string,
      department: department as string,
      locality: locality as string,
      openOnly: openOnly === 'true',
      maxWait: maxWait ? Number(maxWait) : undefined,
      sortBy: (sort as any) || 'wait'
    });
    res.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/hospitals/:id - Full hospital detail with departments, doctors, & queue stats
hospitalRouter.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid hospital ID.' });
    }
    const hospital = HospitalService.getHospitalDetail(id);
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital not found.' });
    }
    res.json({ success: true, data: hospital });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/hospitals/meta/departments - Distinct departments across all hospitals
hospitalRouter.get('/meta/departments', (req, res) => {
  try {
    const rows = db.prepare('SELECT DISTINCT name FROM departments ORDER BY name ASC').all() as { name: string }[];
    res.json({ success: true, data: rows.map(r => r.name) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/hospitals/meta/localities - Distinct localities
hospitalRouter.get('/meta/localities', (req, res) => {
  try {
    const rows = db.prepare('SELECT DISTINCT locality FROM hospitals ORDER BY locality ASC').all() as { locality: string }[];
    res.json({ success: true, data: rows.map(r => r.locality) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/hospitals/doctors/:id/slots - Available appointment slots for a doctor
hospitalRouter.get('/doctors/:id/slots', (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    if (isNaN(doctorId) || doctorId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid doctor ID.' });
    }
    const date = req.query.date as string;
    const slots = HospitalService.getAvailableSlots(doctorId, date);
    res.json({ success: true, data: slots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
