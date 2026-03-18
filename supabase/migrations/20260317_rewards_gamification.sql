-- ══════════════════════════════════════════════════════════
-- MajordHome — Récompenses & Gamification
-- ══════════════════════════════════════════════════════════

-- Fonction utilitaire : calcule le niveau depuis les XP
CREATE OR REPLACE FUNCTION calculate_level(p_xp INT)
RETURNS INT AS $$
BEGIN
  IF p_xp >= 2000 THEN RETURN 5;
  ELSIF p_xp >= 1000 THEN RETURN 4;
  ELSIF p_xp >= 600 THEN RETURN 3;
  ELSIF p_xp >= 300 THEN RETURN 2;
  ELSIF p_xp >= 100 THEN RETURN 1;
  ELSE RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Table stats joueurs
CREATE TABLE IF NOT EXISTS player_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id           TEXT NOT NULL,
  total_xp          INT DEFAULT 0,
  level             INT DEFAULT 0,
  current_streak    INT DEFAULT 0,
  best_streak       INT DEFAULT 0,
  last_active_date  DATE,
  tasks_completed   INT DEFAULT 0,
  chores_completed  INT DEFAULT 0,
  shopping_checked  INT DEFAULT 0,
  food_added        INT DEFAULT 0,
  events_created    INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, user_id)
);

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_streak  INT DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS best_streak     INT DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS last_active_date DATE;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS tasks_completed  INT DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS chores_completed INT DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS shopping_checked INT DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS food_added       INT DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS events_created   INT DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- Catalogue badges
CREATE TABLE IF NOT EXISTS badge_definitions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  category    TEXT NOT NULL,
  rarity      TEXT DEFAULT 'common',
  xp_reward   INT DEFAULT 10,
  condition   JSONB,
  sort_order  INT DEFAULT 0
);

-- Badges débloqués
CREATE TABLE IF NOT EXISTS player_badges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id      TEXT NOT NULL,
  badge_id     TEXT REFERENCES badge_definitions(id),
  unlocked_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id, household_id)
);

-- Historique XP
CREATE TABLE IF NOT EXISTS xp_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id      TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  xp_earned    INT NOT NULL,
  description  TEXT,
  related_id   UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_player_stats_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS player_stats_updated_at ON player_stats;
CREATE TRIGGER player_stats_updated_at BEFORE UPDATE ON player_stats FOR EACH ROW EXECUTE FUNCTION update_player_stats_timestamp();

-- Index
CREATE INDEX IF NOT EXISTS idx_player_stats_household  ON player_stats(household_id, total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_player_badges_user      ON player_badges(household_id, user_id);
CREATE INDEX IF NOT EXISTS idx_xp_history_household    ON xp_history(household_id, created_at DESC);

-- RLS
ALTER TABLE player_stats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_badges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_stats"    ON player_stats;
DROP POLICY IF EXISTS "household_badges"   ON player_badges;
DROP POLICY IF EXISTS "household_history"  ON xp_history;
DROP POLICY IF EXISTS "badges_public_read" ON badge_definitions;

CREATE POLICY "household_stats"    ON player_stats    FOR ALL USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "household_badges"   ON player_badges   FOR ALL USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "household_history"  ON xp_history      FOR ALL USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "badges_public_read" ON badge_definitions FOR SELECT USING (true);

-- Données initiales badges (idempotent)
INSERT INTO badge_definitions (id, name, description, emoji, category, rarity, xp_reward, condition, sort_order) VALUES
  ('first_task',    'Première tâche !',    'Complète ta première tâche',        '🌟', 'tasks',   'common',    10,  '{"tasks_completed": 1}',    1),
  ('task_5',        'Régulier',            '5 tâches accomplies',               '📋', 'tasks',   'common',    15,  '{"tasks_completed": 5}',    2),
  ('task_10',       'Assidu',              '10 tâches accomplies',              '💪', 'tasks',   'rare',      25,  '{"tasks_completed": 10}',   3),
  ('task_25',       'Travailleur',         '25 tâches accomplies',              '🏋', 'tasks',   'rare',      40,  '{"tasks_completed": 25}',   4),
  ('task_50',       'Acharné',             '50 tâches accomplies',              '⚡', 'tasks',   'epic',      75,  '{"tasks_completed": 50}',   5),
  ('task_100',      'Légendaire',          '100 tâches accomplies',             '🔥', 'tasks',   'legendary', 150, '{"tasks_completed": 100}',  6),
  ('streak_3',      '3 jours d''affilée', '3 jours consécutifs d''activité',   '🔥', 'streak',  'common',    20,  '{"streak": 3}',             10),
  ('streak_7',      'Une semaine !',       '7 jours consécutifs d''activité',   '🗓', 'streak',  'rare',      50,  '{"streak": 7}',             11),
  ('streak_14',     'Deux semaines',       '14 jours consécutifs d''activité',  '💎', 'streak',  'epic',      100, '{"streak": 14}',            12),
  ('streak_30',     'Un mois entier !',    '30 jours consécutifs d''activité',  '👑', 'streak',  'legendary', 200, '{"streak": 30}',            13),
  ('first_chore',   'Première corvée',     'Complète ta première corvée',       '🧹', 'special', 'common',    15,  '{"chores_completed": 1}',   20),
  ('first_shopping','Premier achat',       'Coche 5 articles de liste',         '🛒', 'special', 'common',    10,  '{"shopping_checked": 5}',   21),
  ('team_player',   'Esprit d''équipe',    'Effectue 3 tâches pour les autres', '🤝', 'social',  'rare',      30,  '{"tasks_for_others": 3}',   30),
  ('chef',          'Chef cuisinier',      'Ajoute 3 recettes au repas',        '🍳', 'special', 'epic',      60,  '{"recipes_added": 3}',      31),
  ('organized',     'Bien organisé',       'Crée 5 événements dans le foyer',   '📅', 'special', 'rare',      40,  '{"events_created": 5}',     32),
  ('zero_waste',    'Zéro Gaspillage',     'Consomme 10 aliments avant péremption','♻', 'special', 'epic',   80,  '{"food_consumed": 10}',     33)
ON CONFLICT (id) DO NOTHING;

-- RPC classement
CREATE OR REPLACE FUNCTION get_leaderboard(p_household_id UUID)
RETURNS TABLE(rank INT, user_id TEXT, display_name TEXT, color TEXT, avatar_emoji TEXT,
              total_xp INT, level INT, current_streak INT, best_streak INT, badges_count INT, tasks_completed INT)
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.total_xp DESC)::INT AS rank,
    ps.user_id,
    hm.display_name,
    hm.color,
    hm.avatar_emoji,
    ps.total_xp,
    ps.level,
    ps.current_streak,
    ps.best_streak,
    COUNT(pb.id)::INT AS badges_count,
    ps.tasks_completed
  FROM player_stats ps
  JOIN household_members hm
    ON hm.user_id::TEXT = ps.user_id
   AND hm.household_id  = ps.household_id
  LEFT JOIN player_badges pb
    ON pb.user_id::TEXT = ps.user_id
   AND pb.household_id  = ps.household_id
  WHERE ps.household_id = p_household_id
  GROUP BY ps.user_id, hm.display_name, hm.color,
           hm.avatar_emoji, ps.total_xp, ps.level,
           ps.current_streak, ps.best_streak, ps.tasks_completed
  ORDER BY ps.total_xp DESC
$$ LANGUAGE sql SECURITY DEFINER;

-- Realtime (safe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='player_stats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE player_stats;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='player_badges') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE player_badges;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='xp_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE xp_history;
  END IF;
END $$;
