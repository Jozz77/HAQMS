-- Challenge 3: DB constraints + indexes

-- Enforce one appointment per doctor per exact appointmentDate slot
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_doctorId_appointmentDate_key"
ON "Appointment"("doctorId", "appointmentDate");

-- Speed up appointment status/fk-heavy queries
CREATE INDEX IF NOT EXISTS "Appointment_status_idx"
ON "Appointment"("status");

CREATE INDEX IF NOT EXISTS "Appointment_doctorId_status_appointmentDate_idx"
ON "Appointment"("doctorId", "status", "appointmentDate");

-- Speed up queue board/status lookups
CREATE INDEX IF NOT EXISTS "QueueToken_status_idx"
ON "QueueToken"("status");

CREATE INDEX IF NOT EXISTS "QueueToken_doctorId_status_createdAt_idx"
ON "QueueToken"("doctorId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "QueueToken_appointmentId_idx"
ON "QueueToken"("appointmentId");

-- Speed up patient filters
CREATE INDEX IF NOT EXISTS "Patient_gender_idx"
ON "Patient"("gender");

CREATE INDEX IF NOT EXISTS "Patient_createdAt_idx"
ON "Patient"("createdAt");

-- Speed up doctor filtering
CREATE INDEX IF NOT EXISTS "Doctor_department_idx"
ON "Doctor"("department");

CREATE INDEX IF NOT EXISTS "Doctor_specialization_idx"
ON "Doctor"("specialization");

