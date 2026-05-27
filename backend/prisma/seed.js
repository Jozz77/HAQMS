const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertUser({ email, name, role, password }) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      password: hashedPassword,
    },
    create: {
      email,
      name,
      role,
      password: hashedPassword,
    },
  });
}

async function main() {
  const commonPassword = 'password123';

  await Promise.all([
    upsertUser({
      email: 'admin@haqms.com',
      name: 'Admin User',
      role: 'ADMIN',
      password: commonPassword,
    }),
    upsertUser({
      email: 'reception1@haqms.com',
      name: 'Receptionist One',
      role: 'RECEPTIONIST',
      password: commonPassword,
    }),
    upsertUser({
      email: 'doctor1@haqms.com',
      name: 'Doctor One',
      role: 'DOCTOR',
      password: commonPassword,
    }),
  ]);

  // Minimal domain seed data for API smoke tests
  const [doctor, patient] = await Promise.all([
    prisma.doctor.upsert({
      where: { id: 'doctor_seed_1' },
      update: {},
      create: {
        id: 'doctor_seed_1',
        name: 'Dr. Seed',
        specialization: 'General',
        department: 'General',
        consultationFee: 2000,
        experience: 5,
      },
    }),
    prisma.patient.upsert({
      where: { id: 'patient_seed_1' },
      update: {},
      create: {
        id: 'patient_seed_1',
        name: 'Seed Patient',
        email: 'patient1@haqms.com',
        phoneNumber: '08000000000',
        age: 30,
        gender: 'OTHER',
        medicalHistory: null,
      },
    }),
  ]);

  await prisma.appointment.upsert({
    where: { id: 'appointment_seed_1' },
    update: {},
    create: {
      id: 'appointment_seed_1',
      patientId: patient.id,
      doctorId: doctor.id,
      appointmentDate: new Date(Date.now() + 60 * 60 * 1000),
      reason: 'Seed appointment',
      status: 'PENDING',
    },
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });