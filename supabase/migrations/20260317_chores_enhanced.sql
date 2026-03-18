-- ══════════════════════════════════════════════════════════
-- MajordHome — Corvées Récurrentes v2 (Enhanced Schema)
-- ══════════════════════════════════════════════════════════

-- Enhanced chores table
CREATE TABLE IF NOT EXISTS chores (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by             TEXT NOT NULL,
  title                  TEXT NOT NULL,
  description            TEXT,
  category               TEXT DEFAULT 'autre',
  frequency              TEXT NOT NULL DEFAULT 'weekly',
  frequency_day          INT,
  rotation_type          TEXT DEFAULT 'round_robin',
  rotation_members       TEXT[] DEFAULT '{}',
  current_assignee_index INT DEFAULT 0,
  is_active              BOOLEAN DEFAULT true,
  is_paused              BOOLEAN DEFAULT false,
  duration_min           INT DEFAULT 15,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Occurrences table (history)
CREATE TABLE IF NOT EXISTS chore_occurrences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id     UUID REFERENCES chores(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  assigned_to  TEXT NOT NULL,
  due_date     DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  was_skipped  BOOLEAN DEFAULT false,
  skip_reason  TEXT,
  swapped_with TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Auto updated_at trigger
CREATE OR REPLACE FUNCTION update_chore_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chores_updated_at ON chores;
CREATE TRIGGER chores_updated_at BEFORE UPDATE ON chores
  FOR EACH ROW EXECUTE FUNCTION update_chore_timestamp();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chore_occ_chore_date  ON chore_occurrences(chore_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_chore_occ_assigned     ON chore_occurrences(assigned_to, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_chore_occ_household    ON chore_occurrences(household_id, due_date DESC);

-- RLS
ALTER TABLE chores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_chores"     ON chores;
DROP POLICY IF EXISTS "household_chore_occ"  ON chore_occurrences;

CREATE POLICY "household_chores" ON chores FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "household_chore_occ" ON chore_occurrences FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

-- Balance stats RPC
CREATE OR REPLACE FUNCTION get_chores_balance(
  p_household_id UUID,
  p_start DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_end   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(user_id TEXT, display_name TEXT, color TEXT, done_count INT, total_min INT, pct DECIMAL)
AS $$
  WITH member_stats AS (
    SELECT hm.user_id::TEXT, hm.display_name, hm.color,
      COUNT(co.id) FILTER (WHERE co.completed_at IS NOT NULL) AS done_count,
      COALESCE(SUM(c.duration_min) FILTER (WHERE co.completed_at IS NOT NULL), 0) AS total_min
    FROM household_members hm
    LEFT JOIN chore_occurrences co ON co.assigned_to = hm.user_id::TEXT
      AND co.due_date BETWEEN p_start AND p_end
      AND co.household_id = p_household_id
    LEFT JOIN chores c ON c.id = co.chore_id
    WHERE hm.household_id = p_household_id
    GROUP BY hm.user_id, hm.display_name, hm.color
  ),
  total AS (SELECT GREATEST(SUM(done_count), 1) AS t FROM member_stats)
  SELECT ms.user_id, ms.display_name, ms.color,
    ms.done_count::INT, ms.total_min::INT,
    ROUND((ms.done_count::DECIMAL / t.t) * 100, 1) AS pct
  FROM member_stats ms, total t
  ORDER BY ms.done_count DESC
$$ LANGUAGE sql SECURITY DEFINER;

-- Realtime (safe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chores') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chores;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chore_occurrences') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chore_occurrences;
  END IF;
END $$;
