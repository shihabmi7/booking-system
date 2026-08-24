import { PrismaClient } from "@prisma/client";

// Single shared Prisma Client instance for the whole app. Unlike the old pg.Pool,
// you don't need to manage pooling yourself — Prisma handles its own connection
// pool internally. Every file that needs the database imports this same instance.
export const prisma = new PrismaClient();
