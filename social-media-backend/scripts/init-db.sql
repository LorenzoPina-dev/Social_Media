-- ============================================================================
-- Database Initialization Script
-- Social Media Platform - Development Environment
-- ============================================================================
-- Eseguito automaticamente da docker-compose al primo avvio del container
-- PostgreSQL tramite il volume /docker-entrypoint-initdb.d/
-- ============================================================================

-- Enable required extensions (applicate al DB corrente = "postgres")
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- ─── Crea utente applicativo ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'social_media_app') THEN
    CREATE ROLE social_media_app WITH LOGIN PASSWORD 'social_media_password';
  END IF;
END
$$;

-- ─── Helper: crea DB se non esiste ────────────────────────────────────────────
-- PostgreSQL non supporta CREATE DATABASE IF NOT EXISTS, quindi usiamo
-- un DO block che cattura l'eccezione duplicate_database (codice 42P04).
CREATE OR REPLACE PROCEDURE create_db_if_not_exists(db_name TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_catalog.pg_database.datname
  FROM pg_catalog.pg_database
  WHERE datname = db_name;

  IF NOT FOUND THEN
    EXECUTE format('CREATE DATABASE %I', db_name);
    RAISE NOTICE 'Database "%" created', db_name;
  ELSE
    RAISE NOTICE 'Database "%" already exists — skipped', db_name;
  END IF;
END;
$$;

-- ─── Database di produzione/sviluppo ──────────────────────────────────────────
CALL create_db_if_not_exists('auth_db');
CALL create_db_if_not_exists('user_db');
CALL create_db_if_not_exists('post_db');
CALL create_db_if_not_exists('media_db');
CALL create_db_if_not_exists('interaction_db');
CALL create_db_if_not_exists('notification_db');
CALL create_db_if_not_exists('moderation_db');

-- ─── Database di test (uno per servizio) ──────────────────────────────────────
CALL create_db_if_not_exists('auth_test_db');
CALL create_db_if_not_exists('user_test_db');
CALL create_db_if_not_exists('post_test_db');
CALL create_db_if_not_exists('media_test_db');
CALL create_db_if_not_exists('interaction_test_db');
CALL create_db_if_not_exists('notification_test_db');
CALL create_db_if_not_exists('moderation_test_db');

-- ─── Estensioni nei DB di servizio ────────────────────────────────────────────
-- Le estensioni uuid-ossp e pgcrypto devono essere abilitate anche in ogni DB
-- perché DEFAULT gen_random_uuid() ne ha bisogno.
-- Nota: non è possibile eseguire \connect in SQL puro, quindi questo viene
-- gestito dai singoli init-db.ts di ogni servizio al momento delle migration.
-- In alternativa, usare il superuser "postgres" manualmente:
--   \c auth_db
--   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- oppure affidarsi a Knex che lo fa nella prima migration.

-- ─── Grant privileges sull'utente applicativo ─────────────────────────────────
-- I GRANT per i singoli DB vengono applicati dopo la connessione a ciascun DB.
-- Questo blocco gestisce solo il DB corrente (postgres) come bootstrap.
DO $$
DECLARE
  db_name TEXT;
  db_list TEXT[] := ARRAY[
    'auth_db', 'auth_test_db',
    'user_db', 'user_test_db',
    'post_db', 'post_test_db',
    'media_db', 'media_test_db',
    'interaction_db', 'interaction_test_db',
    'notification_db', 'notification_test_db',
    'moderation_db', 'moderation_test_db'
  ];
BEGIN
  FOREACH db_name IN ARRAY db_list LOOP
    BEGIN
      EXECUTE format(
        'GRANT ALL PRIVILEGES ON DATABASE %I TO social_media_app', db_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not grant on %: %', db_name, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- ─── Funzione helper aggiornamento updated_at (nel DB postgres/template) ──────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Log ──────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'init-db.sql completato alle %', NOW();
  RAISE NOTICE 'DB creati: auth_db, user_db, post_db, media_db,';
  RAISE NOTICE '           interaction_db, notification_db, moderation_db';
  RAISE NOTICE 'Test DB:   *_test_db per ciascun servizio';
  RAISE NOTICE '============================================================';
END;
$$;
