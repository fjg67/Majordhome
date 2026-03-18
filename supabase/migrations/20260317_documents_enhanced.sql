-- ══════════════════════════════════════════════════════════
-- MajordHome — Documents du foyer v2 (Enhanced Schema)
-- ══════════════════════════════════════════════════════════

-- Créer la table si elle n'existe pas encore (première installation)
CREATE TABLE IF NOT EXISTS documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  uploaded_by    TEXT NOT NULL DEFAULT '',
  title          TEXT NOT NULL DEFAULT '',
  file_url       TEXT NOT NULL DEFAULT '',
  file_type      TEXT NOT NULL DEFAULT 'other',
  file_size      BIGINT NOT NULL DEFAULT 0,
  file_name      TEXT NOT NULL DEFAULT '',
  category       TEXT DEFAULT 'autre',
  tags           TEXT[] DEFAULT '{}',
  is_important   BOOLEAN DEFAULT false,
  is_shared      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- Ajout des nouvelles colonnes (safe — ignorées si déjà présentes)
-- ══════════════════════════════════════════════════════════
ALTER TABLE documents ADD COLUMN IF NOT EXISTS thumbnail_url  TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type      TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description    TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_date  DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date    DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_important   BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_shared      BOOLEAN DEFAULT true;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type      TEXT NOT NULL DEFAULT 'other';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size      BIGINT NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name      TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by    TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

-- Migrer file_size INTEGER → BIGINT si nécessaire
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents'
      AND column_name = 'file_size'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE documents ALTER COLUMN file_size TYPE BIGINT;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════
-- Trigger updated_at
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_document_timestamp();

-- ══════════════════════════════════════════════════════════
-- Index
-- ══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_docs_household_created
  ON documents(household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_category
  ON documents(household_id, category);

-- Index expiry — créé dans un bloc DO pour éviter l'erreur si la colonne manque
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'documents' AND indexname = 'idx_docs_expiry'
  ) THEN
    CREATE INDEX idx_docs_expiry ON documents(expiry_date) WHERE expiry_date IS NOT NULL;
  END IF;
END $$;

-- Index full-text search (recréé si nécessaire)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'documents' AND indexname = 'idx_docs_search'
  ) THEN
    CREATE INDEX idx_docs_search
      ON documents USING GIN(to_tsvector('french', title || ' ' || COALESCE(description, '')));
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_documents" ON documents;
CREATE POLICY "household_documents" ON documents FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════
-- Storage bucket (idempotent)
-- ══════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('household-documents', 'household-documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "household_docs_storage" ON storage.objects;
CREATE POLICY "household_docs_storage" ON storage.objects FOR ALL
  USING (
    bucket_id = 'household-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT household_id::text FROM household_members WHERE user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════
-- RPC get_storage_stats
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_storage_stats(p_household_id UUID)
RETURNS TABLE(total_docs INT, total_size BIGINT, expiring_soon INT)
AS $$
  SELECT
    COUNT(*)::INT                                                      AS total_docs,
    COALESCE(SUM(file_size), 0)                                        AS total_size,
    COUNT(*) FILTER (
      WHERE expiry_date BETWEEN CURRENT_DATE
            AND CURRENT_DATE + INTERVAL '30 days'
    )::INT                                                             AS expiring_soon
  FROM documents
  WHERE household_id = p_household_id
$$ LANGUAGE sql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════
-- Realtime (safe)
-- ══════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;
END $$;
