import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import "dotenv/config";

// Configure WebSocket constructor properly
try {
  neonConfig.webSocketConstructor = ws;
} catch (error: unknown) {
  console.warn('WebSocket configuration warning:', error instanceof Error ? error.message : 'Unknown error');
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create pool with better error handling and connection settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Handle pool errors gracefully
pool.on('error', (err: unknown) => {
  console.error('Database pool error:', err instanceof Error ? err.message : 'Unknown error');
});

export const db = drizzle({ client: pool, schema });
