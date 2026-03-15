-- ═══════════════════════════════════════════════════════════
-- Majordhome — Schéma Supabase complet avec RLS
-- (safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ═══════════════════════════════════════════════════════════

-- ─── Households (foyers partagés) ────────────────────────
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Members (membres du foyer) ─────────────────────────
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🙂',
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, user_id)
);

-- ─── Events (événements calendrier) ─────────────────────
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  color TEXT,
  is_all_day BOOLEAN DEFAULT false,
  recurrence TEXT DEFAULT 'none',
  category TEXT DEFAULT 'other',
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Tasks (tâches) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Food Items (suivi DLC) ─────────────────────────────
CREATE TABLE IF NOT EXISTS food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  expiry_date DATE NOT NULL,
  category TEXT DEFAULT 'other',
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Shopping List ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT DEFAULT 'other',
  checked BOOLEAN DEFAULT false,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- ─── Helper function to get user's household IDs (bypasses RLS) ──
CREATE OR REPLACE FUNCTION get_my_household_ids()
RETURNS SETOF UUID AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Households policies ─────────────────────────────────
DROP POLICY IF EXISTS "users_see_own_households" ON households;
CREATE POLICY "users_see_own_households" ON households
  FOR SELECT USING (
    id IN (SELECT get_my_household_ids())
  );

DROP POLICY IF EXISTS "users_create_households" ON households;
CREATE POLICY "users_create_households" ON households
  FOR INSERT WITH CHECK (true);

-- ─── Household Members policies ──────────────────────────
DROP POLICY IF EXISTS "members_see_household_members" ON household_members;
CREATE POLICY "members_see_household_members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT get_my_household_ids())
  );

DROP POLICY IF EXISTS "members_insert_self" ON household_members;
CREATE POLICY "members_insert_self" ON household_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "members_update_self" ON household_members;
CREATE POLICY "members_update_self" ON household_members
  FOR UPDATE USING (user_id = auth.uid());

-- ─── Events policies ────────────────────────────────────
DROP POLICY IF EXISTS "events_household_access" ON events;
CREATE POLICY "events_household_access" ON events
  FOR ALL USING (
    household_id IN (SELECT get_my_household_ids())
  );

-- ─── Tasks policies ─────────────────────────────────────
DROP POLICY IF EXISTS "tasks_household_access" ON tasks;
CREATE POLICY "tasks_household_access" ON tasks
  FOR ALL USING (
    household_id IN (SELECT get_my_household_ids())
  );

-- ─── Food Items policies ────────────────────────────────
DROP POLICY IF EXISTS "food_items_household_access" ON food_items;
CREATE POLICY "food_items_household_access" ON food_items
  FOR ALL USING (
    household_id IN (SELECT get_my_household_ids())
  );

-- ─── Shopping Items policies ────────────────────────────
DROP POLICY IF EXISTS "shopping_items_household_access" ON shopping_items;
CREATE POLICY "shopping_items_household_access" ON shopping_items
  FOR ALL USING (
    household_id IN (SELECT get_my_household_ids())
  );

-- ═══════════════════════════════════════════════════════════
-- RPC : Statistiques des tâches par membre
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_task_stats(
  p_household_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  color TEXT,
  completed_count INT,
  total_count INT
) AS $$
  SELECT
    hm.user_id,
    hm.display_name,
    hm.color,
    COUNT(t.completed_at) FILTER (WHERE t.completed_at IS NOT NULL)::INT AS completed_count,
    COUNT(t.id)::INT AS total_count
  FROM household_members hm
  LEFT JOIN tasks t ON t.assigned_to = hm.user_id
    AND t.due_date BETWEEN p_start AND p_end
    AND t.household_id = p_household_id
  WHERE hm.household_id = p_household_id
  GROUP BY hm.user_id, hm.display_name, hm.color
$$ LANGUAGE sql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- RPC : Créer un foyer + s'ajouter comme admin
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_household_with_member(p_name TEXT)
RETURNS households
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_household households%ROWTYPE;
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO households (name)
  VALUES (p_name)
  RETURNING * INTO new_household;

  INSERT INTO household_members (household_id, user_id, display_name, color, role)
  VALUES (new_household.id, auth.uid(), split_part(user_email, '@', 1), '#4ECDC4', 'admin');

  RETURN new_household;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- RPC : Ajouter un membre familial (sans compte utilisateur)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_family_member(
  p_household_id UUID,
  p_display_name TEXT,
  p_color TEXT,
  p_avatar_emoji TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  -- Vérifier que l'appelant est admin du foyer
  IF NOT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Seul un admin peut ajouter des membres';
  END IF;

  INSERT INTO household_members (household_id, user_id, display_name, color, avatar_emoji, role)
  VALUES (p_household_id, NULL, p_display_name, p_color, p_avatar_emoji, 'member')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- Realtime — Activer les publications (ignore errors if already added)
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE food_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shopping_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE household_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- Migration : permettre d'assigner des tâches aux membres sans compte
-- (supprime la FK auth.users sur assigned_to/completed_by)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION migrate_drop_task_user_fks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
  ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_completed_by_fkey;
END;
$$;

-- ─── Device Tokens (push notifications FCM) ─────────────
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,  -- 'ios' | 'android'
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_tokens" ON device_tokens;
CREATE POLICY "own_tokens" ON device_tokens
  FOR ALL USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- RPC : Rejoindre un foyer par code d'invitation
-- (SECURITY DEFINER pour contourner la RLS sur households)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION join_household_by_code(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_household_id UUID;
  user_email TEXT;
BEGIN
  -- Chercher le foyer par code (case-insensitive)
  SELECT id INTO found_household_id
  FROM households
  WHERE lower(invite_code) = lower(trim(p_invite_code));

  IF found_household_id IS NULL THEN
    RAISE EXCEPTION 'Code d''invitation invalide';
  END IF;

  -- Vérifier que l'utilisateur n'est pas déjà membre
  IF EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = found_household_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous êtes déjà membre de ce foyer';
  END IF;

  -- Récupérer l'email pour générer le display_name par défaut
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  -- Insérer le nouveau membre
  INSERT INTO household_members (household_id, user_id, display_name, color, role)
  VALUES (found_household_id, auth.uid(), split_part(user_email, '@', 1), '#4ECDC4', 'member');

  RETURN found_household_id;
END;
$$;
