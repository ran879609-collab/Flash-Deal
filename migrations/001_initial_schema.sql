-- ==============================================================================
-- CyclePro Pro — Supabase / PostgreSQL Schema & RLS Security Policies
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles / Users Table (Integrated with Supabase Auth or Custom Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'analyst')),
    department VARCHAR(100) DEFAULT '电商运营部',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    original_sku VARCHAR(150) NOT NULL,
    split_sku VARCHAR(150) DEFAULT '',
    type VARCHAR(100) DEFAULT '',
    item_id VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_original_sku UNIQUE (user_id, original_sku)
);

-- Indexes for ultra-fast SKU lookup
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_original_sku ON products(original_sku);
CREATE INDEX IF NOT EXISTS idx_products_split_sku ON products(split_sku);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);

-- 4. Activity Records Table
CREATE TABLE IF NOT EXISTS activity_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    year INT NOT NULL CHECK (year >= 2000 AND year <= 2100),
    week VARCHAR(20) NOT NULL, -- Format: '2025-W01'
    week_num INT NOT NULL CHECK (week_num >= 1 AND week_num <= 53),
    sku VARCHAR(150) NOT NULL,
    sub_id VARCHAR(100) DEFAULT '',
    parent_id VARCHAR(100) DEFAULT '',
    avg_orders NUMERIC(12, 2) DEFAULT NULL,
    selling_price NUMERIC(12, 2) DEFAULT NULL,
    expected_orders NUMERIC(12, 2) DEFAULT NULL,
    price NUMERIC(12, 2) DEFAULT NULL,
    remark TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_activity_sku_week UNIQUE (user_id, sku, week)
);

-- Indexes for multi-million row querying & aggregation
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activity_records(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_sku ON activity_records(sku);
CREATE INDEX IF NOT EXISTS idx_activities_year_week ON activity_records(year, week_num);
CREATE INDEX IF NOT EXISTS idx_activities_user_sku_week ON activity_records(user_id, sku, week);

-- 5. Import Jobs Table (Tracking background import & batch progress)
CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'product' or 'activity'
    mode VARCHAR(20) NOT NULL DEFAULT 'append' CHECK (mode IN ('append', 'replace')),
    total_rows INT NOT NULL DEFAULT 0,
    success_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_summary TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);

-- 6. Audit Logs Table (Tracking sensitive operations like Clear, Replace, Export)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ==============================================================================
-- Row Level Security (RLS) Policies (PostgreSQL / Supabase)
-- ==============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Products RLS: Users can only select/insert/update/delete their own products
CREATE POLICY products_user_isolation ON products
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Activity Records RLS
CREATE POLICY activities_user_isolation ON activity_records
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Import Jobs RLS
CREATE POLICY import_jobs_user_isolation ON import_jobs
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Audit Logs RLS: Admin can view all, users view their own
CREATE POLICY audit_logs_isolation ON audit_logs
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
