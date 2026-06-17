-- Enable pgvector extension for semantic search / embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add is_blocked column to users table for user blocking/suspension feature
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;
