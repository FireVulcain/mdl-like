import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // This fixed ID is intentional for local dev with SKIP_AUTH=true.
  // The app's getCurrentUserId() returns this ID when SKIP_AUTH=true (via DEV_USER_ID env or fallback).
  const id = 'mock-user-1';
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: 'Mock User',
      email: 'mock@example.com',
    },
  });
  console.log(`Dev seed user ensured (id: ${id}).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
