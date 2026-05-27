-- Create enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
    CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
    CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QueueStatus') THEN
    CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLING', 'COMPLETED', 'SKIPPED');
  END IF;
END $$;

-- CreateTable: Patient
CREATE TABLE IF NOT EXISTS "Patient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phoneNumber" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "gender" "Gender" NOT NULL,
  "medicalHistory" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Doctor
CREATE TABLE IF NOT EXISTS "Doctor" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "specialization" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "consultationFee" INTEGER NOT NULL DEFAULT 0,
  "experience" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Appointment
CREATE TABLE IF NOT EXISTS "Appointment" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "appointmentDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QueueToken
CREATE TABLE IF NOT EXISTS "QueueToken" (
  "id" TEXT NOT NULL,
  "tokenNumber" INTEGER NOT NULL,
  "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "appointmentId" TEXT,
  CONSTRAINT "QueueToken_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QueueToken"
  ADD CONSTRAINT "QueueToken_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QueueToken"
  ADD CONSTRAINT "QueueToken_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QueueToken"
  ADD CONSTRAINT "QueueToken_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_appointmentDate_idx" ON "Appointment"("doctorId", "appointmentDate");
CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX IF NOT EXISTS "QueueToken_doctorId_createdAt_idx" ON "QueueToken"("doctorId", "createdAt");
CREATE INDEX IF NOT EXISTS "QueueToken_patientId_createdAt_idx" ON "QueueToken"("patientId", "createdAt");

