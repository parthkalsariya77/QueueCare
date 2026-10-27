import { Router } from 'express';
import { db } from '../db/connection.js';
import { QueueService } from '../services/queue.service.js';
import { getETAInsightsForQueue } from '../services/eta.service.js';

export const queueRouter = Router();

// GET /api/queues/:id - Queue details
queueRouter.get('/:id', (req, res) => {
  try {
    const queueId = Number(req.params.id);
    if (isNaN(queueId) || queueId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid queue ID.' });
    }
    const queue = db.prepare(`
      SELECT 
        q.*,
        h.name as hospital_name,
        dept.name as department_name,
        d.name as doctor_name,
        d.specialization
      FROM queues q
      JOIN hospitals h ON h.id = q.hospital_id
      JOIN departments dept ON dept.id = q.department_id
      JOIN doctors d ON d.id = q.doctor_id
      WHERE q.id = ?
    `).get(queueId);

    if (!queue) {
      return res.status(404).json({ success: false, error: 'Queue not found.' });
    }

    res.json({ success: true, data: queue });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/queues/:id/entries - Active entries in this queue
queueRouter.get('/:id/entries', (req, res) => {
  try {
    const queueId = Number(req.params.id);
    if (isNaN(queueId) || queueId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid queue ID.' });
    }
    const entries = QueueService.getQueueEntries(queueId);
    res.json({ success: true, count: entries.length, data: entries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/queues/:id/events - Recent queue audit log events
queueRouter.get('/:id/events', (req, res) => {
  try {
    const queueId = Number(req.params.id);
    if (isNaN(queueId) || queueId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid queue ID.' });
    }
    const events = QueueService.getQueueEvents(queueId);
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/queues/:id/insights - ETA model insights comparing Adaptive vs Baseline
queueRouter.get('/:id/insights', (req, res) => {
  try {
    const queueId = Number(req.params.id);
    if (isNaN(queueId) || queueId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid queue ID.' });
    }
    const insights = getETAInsightsForQueue(queueId);
    if (!insights) {
      return res.status(404).json({ success: false, error: 'Queue not found.' });
    }
    res.json({ success: true, data: insights });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
