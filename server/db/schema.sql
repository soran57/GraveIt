-- Database Schema for GraveIt (PostgreSQL)

-- Users table storing Google Authenticated accounts
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on google_id for lightning-fast logins and session matches
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Graves table storing coordinate bounds, owner, text, image, design style
CREATE TABLE IF NOT EXISTS graves (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    x_coord INTEGER NOT NULL, -- Grid Column
    y_coord INTEGER NOT NULL, -- Grid Row
    size_type VARCHAR(50) NOT NULL, -- 'small', 'medium', 'large'
    width INTEGER NOT NULL, -- Bounding box columns count
    height INTEGER NOT NULL, -- Bounding box rows count
    epitaph_title VARCHAR(100) NOT NULL,
    epitaph_text TEXT,
    image_url VARCHAR(1024),
    style_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    color VARCHAR(50) DEFAULT '#4b4b4b', -- Custom colors (Node.js backend)
    views INTEGER DEFAULT 0, -- Visit counts (Node.js backend)
    transaction_id VARCHAR(100) UNIQUE
);

-- Index on coordinates for lightning-fast bounding box viewport fetches
CREATE INDEX IF NOT EXISTS idx_graves_coordinates ON graves(x_coord, y_coord);
CREATE INDEX IF NOT EXISTS idx_graves_user_id ON graves(user_id);

-- Table to track flowers laid on graves by users
CREATE TABLE IF NOT EXISTS grave_flowers (
    grave_id INTEGER REFERENCES graves(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (grave_id, user_id)
);

-- Index on grave_flowers user_id
CREATE INDEX IF NOT EXISTS idx_grave_flowers_user_id ON grave_flowers(user_id);

-- Migration for existing databases
ALTER TABLE graves ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100) UNIQUE;

-- Payments table to store completed payment details before plot placement
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    size_type VARCHAR(50) NOT NULL,
    epitaph_title VARCHAR(100) NOT NULL,
    epitaph_text TEXT,
    image_url VARCHAR(1024),
    style_index INTEGER DEFAULT 0,
    color VARCHAR(50) DEFAULT '#4b4b4b',
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on transaction_id
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
