-- ══════════════════════════════════════════════════════════
-- MajordHome — Sondages / Polls
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS polls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by   TEXT NOT NULL,
  question     TEXT NOT NULL,
  emoji        TEXT DEFAULT '🗳️',
  category     TEXT DEFAULT 'general',
  is_anonymous BOOLEAN DEFAULT false,
  is_multiple  BOOLEAN DEFAULT false,
  expires_at   TIMESTAMPTZ,
  status       TEXT DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE polls ADD COLUMN IF NOT EXISTS emoji        TEXT DEFAULT '🗳️';
ALTER TABLE polls ADD COLUMN IF NOT EXISTS category     TEXT DEFAULT 'general';
ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_multiple  BOOLEAN DEFAULT false;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'active';
ALTER TABLE polls ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

-- Convertir created_by UUID → TEXT (drop FK d'abord si elle existe)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'polls_created_by_fkey'
    AND table_name = 'polls'
  ) THEN
    ALTER TABLE polls DROP CONSTRAINT polls_created_by_fkey;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='polls' AND column_name='created_by'
    AND data_type='uuid'
  ) THEN
    ALTER TABLE polls ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
  END IF;
END $$;

ALTER TABLE polls ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS poll_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  text       TEXT NOT NULL,
  emoji      TEXT,
  color      TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE poll_options ADD COLUMN IF NOT EXISTS text       TEXT NOT NULL DEFAULT '';
ALTER TABLE poll_options ADD COLUMN IF NOT EXISTS emoji      TEXT;
ALTER TABLE poll_options ADD COLUMN IF NOT EXISTS color      TEXT;
ALTER TABLE poll_options ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  option_id  UUID REFERENCES poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Drop FK user_id sur poll_votes si UUID
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='poll_votes_user_id_fkey' AND table_name='poll_votes') THEN
    ALTER TABLE poll_votes DROP CONSTRAINT poll_votes_user_id_fkey;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='poll_votes' AND column_name='user_id' AND data_type='uuid') THEN
    ALTER TABLE poll_votes ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;
END $$;

ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS user_id   TEXT NOT NULL DEFAULT '';
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS poll_id   UUID;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS option_id UUID;

-- Unicité idempotente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'poll_votes_poll_id_option_id_user_id_key') THEN
    ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_poll_id_option_id_user_id_key UNIQUE (poll_id, option_id, user_id);
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_polls_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS polls_updated_at ON polls;
CREATE TRIGGER polls_updated_at BEFORE UPDATE ON polls FOR EACH ROW EXECUTE FUNCTION update_polls_timestamp();

-- Index
CREATE INDEX IF NOT EXISTS idx_polls_household ON polls(household_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_poll      ON poll_votes(poll_id, option_id);

-- RLS
ALTER TABLE polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_polls"        ON polls;
DROP POLICY IF EXISTS "household_poll_options" ON poll_options;
DROP POLICY IF EXISTS "household_poll_votes"   ON poll_votes;

CREATE POLICY "household_polls" ON polls FOR ALL
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "household_poll_options" ON poll_options FOR ALL
  USING (poll_id IN (SELECT id FROM polls WHERE household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )));

CREATE POLICY "household_poll_votes" ON poll_votes FOR ALL
  USING (poll_id IN (SELECT id FROM polls WHERE household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )));

-- RPC résultats complets
CREATE OR REPLACE FUNCTION get_poll_results(p_poll_id UUID)
RETURNS TABLE(
  option_id    UUID,
  option_text  TEXT,
  option_emoji TEXT,
  option_color TEXT,
  vote_count   INT,
  pct          DECIMAL,
  voters       JSONB,
  is_winner    BOOLEAN
) AS $$
  WITH vc AS (
    SELECT
      po.id AS option_id, po.text, po.emoji, po.color,
      COUNT(pv.id)::INT AS vote_count
    FROM poll_options po
    LEFT JOIN poll_votes pv ON pv.option_id = po.id
    WHERE po.poll_id = p_poll_id
    GROUP BY po.id, po.text, po.emoji, po.color, po.sort_order
    ORDER BY po.sort_order
  ),
  totals AS (SELECT SUM(vote_count) AS total_cnt FROM vc),
  max_v  AS (SELECT MAX(vote_count) AS max_cnt FROM vc)
  SELECT
    vc.option_id, vc.text, vc.emoji, vc.color,
    vc.vote_count,
    CASE WHEN totals.total_cnt > 0
      THEN ROUND((vc.vote_count::DECIMAL / totals.total_cnt) * 100, 1)
      ELSE 0 END,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', hm.user_id, 'displayName', hm.display_name,
        'color', hm.color, 'avatarEmoji', hm.avatar_emoji
      ))
      FROM poll_votes pv2
      JOIN household_members hm ON hm.user_id::TEXT = pv2.user_id
      WHERE pv2.option_id = vc.option_id
    ), '[]'::jsonb),
    (vc.vote_count = max_v.max_cnt AND vc.vote_count > 0)
  FROM vc, totals, max_v
$$ LANGUAGE sql SECURITY DEFINER;

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='polls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE polls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='poll_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
  END IF;
END $$;
