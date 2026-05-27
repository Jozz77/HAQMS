const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/doctor-stats
// Highly inefficient nested loop aggregate reporting for admin/receptionists dashboard
// PERFORMANCE BUG: Performs multiple nested DB queries inside a loop for every doctor.
// Runs sequentially, blocking/scaling terrible with doctors count.
router.get('/doctor-stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch doctors once
    const doctors = await prisma.doctor.findMany({
      select: {
        id: true,
        name: true,
        specialization: true,
        department: true,
        consultationFee: true,
      },
    });

    // Aggregate appointments per doctor in one query
    const appointmentCounts = await prisma.appointment.groupBy({
      by: ['doctorId', 'status'],
      _count: { _all: true },
    });

    // Aggregate today's queue token counts per doctor in one query
    const queueCounts = await prisma.queueToken.groupBy({
      by: ['doctorId'],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
    });

    const appointmentIndex = new Map(); // doctorId -> { total, completed, cancelled }
    for (const row of appointmentCounts) {
      const key = row.doctorId;
      const existing = appointmentIndex.get(key) || { total: 0, completed: 0, cancelled: 0 };
      existing.total += row._count._all;
      if (row.status === 'COMPLETED') existing.completed += row._count._all;
      if (row.status === 'CANCELLED') existing.cancelled += row._count._all;
      appointmentIndex.set(key, existing);
    }

    const queueIndex = new Map(queueCounts.map((r) => [r.doctorId, r._count._all]));

    const reportData = doctors.map((doc) => {
      const counts = appointmentIndex.get(doc.id) || { total: 0, completed: 0, cancelled: 0 };
      const todayQueueSize = queueIndex.get(doc.id) || 0;
      const revenue = counts.completed * doc.consultationFee;

      return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        department: doc.department,
        totalAppointments: counts.total,
        completedAppointments: counts.completed,
        cancelledAppointments: counts.cancelled,
        todayQueueSize,
        revenue,
      };
    });

    const durationMs = Date.now() - start;

    res.json({
      success: true,
      timeTakenMs: durationMs,
      data: reportData,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
});

module.exports = router;
