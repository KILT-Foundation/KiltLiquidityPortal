-- KILT Liquidity Portal - Local Database Initialization
-- This file will be executed when PostgreSQL starts for the first time

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE kilt_liquidity_portal'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kilt_liquidity_portal')\gexec

-- Connect to the database
\c kilt_liquidity_portal;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE kilt_liquidity_portal TO postgres;
GRANT ALL ON SCHEMA public TO postgres;

-- Set timezone
SET timezone = 'UTC';

-- Create initial admin user (for testing)
-- This will be handled by Drizzle migrations, but we can set up basic permissions

-- Log successful initialization
SELECT 'KILT Liquidity Portal database initialized successfully!' as status;