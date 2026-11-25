import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

export const db = drizzle(process.env.DATABASE_URL!);

export * from './db/schema';
export { eq, and, inArray, asc, desc, sql } from "drizzle-orm";