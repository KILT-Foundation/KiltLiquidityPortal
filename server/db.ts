import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create PostgreSQL connection pool for production RDS
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle pool errors gracefully
pool.on('error', (err: unknown) => {
  console.error('Database pool error:', err instanceof Error ? err.message : 'Unknown error');
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL RDS in private VPC');
});

export const db = drizzle({ client: pool, schema });
