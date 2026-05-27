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