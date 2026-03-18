-- ══════════════════════════════════════════════════════════
-- MajordHome — Humeurs / Mood Board
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS moods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id        TEXT NOT NULL,
  mood           TEXT NOT NULL CHECK (mood IN ('super','bien','neutre','bof','mauvais')),
  mood_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  note           TEXT,
  is_note_shared BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, user_id, mood_date)
);

ALTER TABLE moods ADD COLUMN IF NOT EXISTS note           TEXT;
ALTER TABLE moods ADD COLUMN IF NOT EXISTS is_note_shared BOOLEAN DEFAULT false;
ALTER TABLE moods ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION update_moods_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS moods_updated_at ON moods;
CREATE TRIGGER moods_updated_at BEFORE UPDATE ON moods FOR EACH ROW EXECUTE FUNCTION update_moods_timestamp();

CREATE INDEX IF NOT EXISTS idx_moods_household_date ON moods(household_id, mood_date DESC);
CREATE INDEX IF NOT EXISTS idx_moods_user_date      ON moods(user_id, mood_date DESC);

ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_moods" ON moods;
CREATE POLICY "household_moods" ON moods FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

-- ══ RPC Stats humeurs ══
CREATE OR REPLACE FUNCTION get_mood_stats(
  p_household_id UUID,
  p_user_id      TEXT,
  p_start        DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_end          DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(mood TEXT, cnt INT, pct DECIMAL, avg_score DECIMAL)
AS $$
  WITH mc AS (
    SELECT mood, COUNT(*)::INT AS cnt
    FROM moods
    WHERE household_id = p_household_id
      AND user_id = p_user_id
      AND mood_date BETWEEN p_start AND p_end
    GROUP BY mood
  ),
  totals AS (SELECT SUM(cnt) AS total_cnt FROM mc)
  SELECT mc.mood, mc.cnt,
    ROUND((mc.cnt::DECIMAL / NULLIF(totals.total_cnt, 0)) * 100, 1),
    ROUND((
      SELECT AVG(CASE m2.mood WHEN 'super' THEN 5 WHEN 'bien' THEN 4 WHEN 'neutre' THEN 3 WHEN 'bof' THEN 2 ELSE 1 END)
      FROM moods m2
      WHERE m2.household_id = p_household_id AND m2.user_id = p_user_id AND m2.mood_date BETWEEN p_start AND p_end
    ), 2)
  FROM mc, totals
  ORDER BY mc.cnt DESC
$$ LANGUAGE sql SECURITY DEFINER;

-- ══ RPC Humeur globale foyer ══
CREATE OR REPLACE FUNCTION get_household_mood(
  p_household_id UUID,
  p_date         DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(global_score DECIMAL, global_mood TEXT, members_mood JSONB)
AS $$
  WITH tm AS (
    SELECT user_id, mood,
      CASE mood WHEN 'super' THEN 5 WHEN 'bien' THEN 4 WHEN 'neutre' THEN 3 WHEN 'bof' THEN 2 ELSE 1 END AS score
    FROM moods WHERE household_id = p_household_id AND mood_date = p_date
  )
  SELECT
    ROUND(AVG(score), 1),
    CASE WHEN AVG(score) >= 4.5 THEN 'super'
         WHEN AVG(score) >= 3.5 THEN 'bien'
         WHEN AVG(score) >= 2.5 THEN 'neutre'
         WHEN AVG(score) >= 1.5 THEN 'bof'
         ELSE 'mauvais' END,
    jsonb_object_agg(user_id, mood)
  FROM tm
$$ LANGUAGE sql SECURITY DEFINER;

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='moods') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE moods;
  END IF;
END $$;
