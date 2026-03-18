-- ══════════════════════════════════════════════════════════
-- MajordHome — Notes Partagées (Enhanced Schema)
-- ══════════════════════════════════════════════════════════

-- Drop old table if exists (or alter to add new columns)
ALTER TABLE IF EXISTS notes
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist JSONB,
  ADD COLUMN IF NOT EXISTS contact_data JSONB,
  ADD COLUMN IF NOT EXISTS recipe_data JSONB,
  ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Migrate old columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'pinned') THEN
    UPDATE notes SET is_pinned = pinned WHERE pinned IS NOT NULL;
    ALTER TABLE notes DROP COLUMN IF EXISTS pinned;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'color') THEN
    UPDATE notes SET accent_color = color WHERE color IS NOT NULL;
    ALTER TABLE notes DROP COLUMN IF EXISTS color;
  END IF;
END $$;

-- Create fresh if not exists
CREATE TABLE IF NOT EXISTS notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by      TEXT NOT NULL,
  last_edited_by  TEXT,
  title           TEXT NOT NULL,
  content         TEXT,
  category        TEXT DEFAULT 'memo',
  accent_color    TEXT,
  is_pinned       BOOLEAN DEFAULT false,
  is_archived     BOOLEAN DEFAULT false,
  checklist       JSONB,
  contact_data    JSONB,
  recipe_data     JSONB,
  attachments     TEXT[] DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_note_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_note_timestamp();

-- Full-text search index
DROP INDEX IF EXISTS idx_notes_search;
CREATE INDEX idx_notes_search
  ON notes USING GIN(to_tsvector('french', title || ' ' || COALESCE(content, '')));

CREATE INDEX IF NOT EXISTS idx_notes_household_updated
  ON notes(household_id, updated_at DESC);

-- RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_notes" ON notes;
CREATE POLICY "household_notes" ON notes FOR ALL
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

-- Full-text search RPC
CREATE OR REPLACE FUNCTION search_notes(p_household_id UUID, p_query TEXT)
RETURNS SETOF notes AS $$
  SELECT * FROM notes
  WHERE household_id = p_household_id
    AND is_archived = false
    AND (
      to_tsvector('french', title || ' ' || COALESCE(content, ''))
      @@ plainto_tsquery('french', p_query)
      OR title ILIKE '%' || p_query || '%'
    )
  ORDER BY
    is_pinned DESC,
    ts_rank(
      to_tsvector('french', title || ' ' || COALESCE(content, '')),
      plainto_tsquery('french', p_query)
    ) DESC
  LIMIT 20
$$ LANGUAGE sql SECURITY DEFINER;

-- Realtime (safe — ignore si déjà membre)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notes;
  END IF;
END $$;
