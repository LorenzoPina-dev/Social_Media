-- ============================================================================
-- Database Initialization Script
-- Social Media Platform - Development Environment
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create database user for services (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'social_media_app') THEN
    CREATE ROLE social_media_app WITH LOGIN PASSWORD 'social_media_password';
  END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE social_media TO social_media_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO social_media_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO social_media_app;

-- Create helper function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Database initialized successfully at %', NOW();
END
$$;
