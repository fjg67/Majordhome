-- ══════════════════════════════════════════════════════════
-- MajordHome — Minuteurs Partagés v2 (Enhanced Schema)
-- ══════════════════════════════════════════════════════════

-- Créer la table timers v2 si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS timers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by    TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  category      TEXT DEFAULT 'autre',
  duration_sec  INT NOT NULL DEFAULT 300,
  status        TEXT DEFAULT 'ready',
  elapsed_sec   INT DEFAULT 0,
  is_shared     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Ajouter les nouvelles colonnes si elles manquent
ALTER TABLE timers ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ;
ALTER TABLE timers ADD COLUMN IF NOT EXISTS paused_at    TIMESTAMPTZ;
ALTER TABLE timers ADD COLUMN IF NOT EXISTS category     TEXT DEFAULT 'autre';
ALTER TABLE timers ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'ready';
ALTER TABLE timers ADD COLUMN IF NOT EXISTS elapsed_sec  INT DEFAULT 0;
ALTER TABLE timers ADD COLUMN IF NOT EXISTS is_shared    BOOLEAN DEFAULT true;
ALTER TABLE timers ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

-- Migrer les anciens champs si nécessaire
DO $$ BEGIN
  -- is_running / is_finished → status
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timers' AND column_name = 'is_running') THEN
    UPDATE timers SET status = CASE
      WHEN is_running  = true  THEN 'running'
      WHEN is_finished = true  THEN 'finished'
      ELSE 'ready'
    END WHERE status IS NULL OR status = 'ready';
  END IF;
  -- duration_seconds → duration_sec
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timers' AND column_name = 'duration_seconds') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timers' AND column_name = 'duration_sec') THEN
    ALTER TABLE timers ADD COLUMN duration_sec INT;
    UPDATE timers SET duration_sec = duration_seconds;
  END IF;
  -- label → title
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timers' AND column_name = 'label') THEN
    UPDATE timers SET title = label WHERE title = '' OR title IS NULL;
  END IF;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_timer_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timers_updated_at ON timers;
CREATE TRIGGER timers_updated_at BEFORE UPDATE ON timers
  FOR EACH ROW EXECUTE FUNCTION update_timer_timestamp();

-- Index
CREATE INDEX IF NOT EXISTS idx_timers_household
  ON timers(household_id, status, created_at DESC);

-- RLS
ALTER TABLE timers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_timers" ON timers;
CREATE POLICY "household_timers" ON timers FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Realtime (safe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'timers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE timers;
  END IF;
END $$;
