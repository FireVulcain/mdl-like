import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Use DATABASE_URL (pooled connection) for runtime
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter, // This uses DATABASE_URL via the pool
        // Every query, serialised and printed — in production too, where nobody
        // reads it and each line costs CPU on a plan that bills exactly that.
        // Kept in development, which is the only place it was ever useful.
        log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
