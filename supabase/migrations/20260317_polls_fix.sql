-- ══════════════════════════════════════════════════════════
-- Fix sondages : options + votes accessibles
-- ══════════════════════════════════════════════════════════

-- 0. RPC SECURITY DEFINER pour créer un sondage complet (poll + options)
--    Contourne totalement le RLS pour la création
CREATE OR REPLACE FUNCTION create_poll_with_options(
  p_household_id  TEXT,
  p_created_by    TEXT,
  p_question      TEXT,
  p_emoji         TEXT,
  p_category      TEXT,
  p_is_anonymous  BOOLEAN,
  p_is_multiple   BOOLEAN,
  p_expires_at    TIMESTAMPTZ,
  p_options       JSONB
) RETURNS JSONB SECURITY DEFINER AS $$
DECLARE
  v_poll_id UUID;
  opt       JSONB;
  i         INT := 0;
BEGIN
  -- Insérer le sondage
  INSERT INTO polls (household_id, created_by, question, emoji, category, is_anonymous, is_multiple, expires_at, status)
  VALUES (
    p_household_id::UUID, p_created_by, p_question, p_emoji, p_category,
    p_is_anonymous, p_is_multiple, p_expires_at, 'active'
  )
  RETURNING id INTO v_poll_id;

  -- Insérer les options (label = text pour compatibilité avec le schéma existant)
  FOR opt IN SELECT * FROM jsonb_array_elements(p_options) LOOP
    INSERT INTO poll_options (poll_id, text, label, color, sort_order)
    VALUES (
      v_poll_id,
      opt->>'text',
      COALESCE(opt->>'label', opt->>'text'),
      opt->>'color',
      COALESCE((opt->>'sort_order')::INT, i)
    );
    i := i + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'poll_id', v_poll_id::TEXT);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 1. Recréer les politiques RLS plus permissives
ALTER TABLE polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_polls"        ON polls;
DROP POLICY IF EXISTS "household_poll_options" ON poll_options;
DROP POLICY IF EXISTS "household_poll_votes"   ON poll_votes;

-- Polls : membres du foyer
CREATE POLICY "household_polls" ON polls FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id::TEXT = auth.uid()::TEXT
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id::TEXT = auth.uid()::TEXT
    )
  );

-- Poll options : visibles si le sondage parent est accessible
CREATE POLICY "household_poll_options" ON poll_options FOR ALL
  USING (
    poll_id IN (
      SELECT id FROM polls
      WHERE household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id::TEXT = auth.uid()::TEXT
      )
    )
  )
  WITH CHECK (
    poll_id IN (
      SELECT id FROM polls
      WHERE household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id::TEXT = auth.uid()::TEXT
      )
    )
  );

-- Poll votes
CREATE POLICY "household_poll_votes" ON poll_votes FOR ALL
  USING (
    poll_id IN (
      SELECT id FROM polls
      WHERE household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id::TEXT = auth.uid()::TEXT
      )
    )
  )
  WITH CHECK (
    poll_id IN (
      SELECT id FROM polls
      WHERE household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id::TEXT = auth.uid()::TEXT
      )
    )
  );

-- 2. RPC SECURITY DEFINER pour récupérer options + votes sans contrainte RLS
CREATE OR REPLACE FUNCTION get_poll_options_with_votes(p_poll_ids UUID[])
RETURNS TABLE(
  id         UUID,
  poll_id    UUID,
  text       TEXT,
  emoji      TEXT,
  color      TEXT,
  sort_order INT,
  votes      JSONB
) SECURITY DEFINER AS $$
  SELECT
    po.id,
    po.poll_id,
    po.text,
    po.emoji,
    po.color,
    po.sort_order,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pv.id,
          'poll_id', pv.poll_id,
          'option_id', pv.option_id,
          'user_id', pv.user_id
        )
      ) FILTER (WHERE pv.id IS NOT NULL),
      '[]'::jsonb
    ) AS votes
  FROM poll_options po
  LEFT JOIN poll_votes pv ON pv.option_id = po.id
  WHERE po.poll_id = ANY(p_poll_ids)
  GROUP BY po.id, po.poll_id, po.text, po.emoji, po.color, po.sort_order
  ORDER BY po.poll_id, po.sort_order;
$$ LANGUAGE sql;

-- 3. RPC SECURITY DEFINER pour voter (contourne les problèmes de type UUID/TEXT)
CREATE OR REPLACE FUNCTION cast_poll_vote(
  p_poll_id   TEXT,
  p_option_id TEXT,
  p_user_id   TEXT,
  p_replace   BOOLEAN DEFAULT TRUE
) RETURNS JSONB SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Supprimer votes précédents si vote unique
  IF p_replace THEN
    DELETE FROM poll_votes
    WHERE poll_id::TEXT = p_poll_id
      AND user_id::TEXT = p_user_id;
  ELSE
    -- Vote multiple : supprimer seulement si revoter sur la même option
    DELETE FROM poll_votes
    WHERE poll_id::TEXT = p_poll_id
      AND option_id::TEXT = p_option_id
      AND user_id::TEXT = p_user_id;
  END IF;

  -- Insérer le nouveau vote
  INSERT INTO poll_votes (poll_id, option_id, user_id)
  VALUES (p_poll_id::UUID, p_option_id::UUID, p_user_id)
  ON CONFLICT (poll_id, option_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 4. RPC SECURITY DEFINER pour insérer les options (contourne RLS INSERT)
CREATE OR REPLACE FUNCTION insert_poll_options(
  p_poll_id TEXT,
  p_options JSONB
) RETURNS VOID SECURITY DEFINER AS $$
DECLARE
  opt JSONB;
  i   INT := 0;
BEGIN
  FOR opt IN SELECT * FROM jsonb_array_elements(p_options) LOOP
    INSERT INTO poll_options (poll_id, text, label, color, sort_order)
    VALUES (
      p_poll_id::UUID,
      opt->>'text',
      COALESCE(opt->>'label', opt->>'text'),
      opt->>'color',
      COALESCE((opt->>'sort_order')::INT, i)
    );
    i := i + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Vérification finale
SELECT COUNT(*) as total_options FROM poll_options;
SELECT COUNT(*) as total_polls FROM polls;
