-- ═══════════════════════════════════════════════════════════
-- Migration V3 — 7 nouvelles fonctionnalités MajordHome
-- Meal Planning, Corvées auto, Sondages, Documents,
-- Météo (client-only), Minuteurs, Tableau d'humeur
-- ═══════════════════════════════════════════════════════════

-- ── 1. MEAL PLANNING ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  title TEXT NOT NULL,
  description TEXT,
  recipe_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES household_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, date, meal_type)
);

CREATE TABLE IF NOT EXISTS meal_plan_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plans_household" ON meal_plans FOR ALL USING (
  household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
);
CREATE POLICY "meal_plan_ingredients_via_plan" ON meal_plan_ingredients FOR ALL USING (
  meal_plan_id IN (
    SELECT id FROM meal_plans WHERE household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  )
);

-- ── 2. CORVÉES RÉCURRENTES (CHORE ROTATIONS) ────────────

CREATE TABLE IF NOT EXISTS chore_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '🧹',
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  member_order UUID[] NOT NULL DEFAULT '{}',
  current_index INT NOT NULL DEFAULT 0,
  last_rotated_at TIMESTAMPTZ DEFAULT now(),
  next_rotation_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES household_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chore_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_id UUID NOT NULL REFERENCES chore_rotations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  note TEXT
);

ALTER TABLE chore_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chore_rotations_household" ON chore_rotations FOR ALL USING (
  household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
);
CREATE POLICY "chore_completions_via_rotation" ON chore_completions FOR ALL USING (
  rotation_id IN (
    SELECT id FROM chore_rotations WHERE household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  )
);

-- ── 3. SONDAGES / VOTES ─────────────────────────────────

CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES household_members(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  emoji TEXT DEFAULT '📊',
  is_multiple_choice BOOLEAN DEFAULT false,
  is_anonymous BOOLEAN DEFAULT false,
  closes_at TIMESTAMPTZ,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, option_id, member_id)
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "polls_household" ON polls FOR ALL USING (
  household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
);
CREATE POLICY "poll_options_via_poll" ON poll_options FOR ALL USING (
  poll_id IN (
    SELECT id FROM polls WHERE household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "poll_votes_via_poll" ON poll_votes FOR ALL USING (
  poll_id IN (
    SELECT id FROM polls WHERE household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  )
);

-- ── 4. DOCUMENTS DU FOYER ───────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES household_members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('invoice', 'contract', 'receipt', 'medical', 'insurance', 'identity', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_household" ON documents FOR ALL USING (
  household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
);

-- ── 5. MINUTEURS PARTAGÉS ───────────────────────────────

CREATE TABLE IF NOT EXISTS shared_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES household_members(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  emoji TEXT DEFAULT '⏱️',
  duration_seconds INT NOT NULL,
  started_at TIMESTAMPTZ,
  is_running BOOLEAN DEFAULT false,
  is_finished BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shared_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_timers_household" ON shared_timers FOR ALL USING (
  household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
);

-- ── 6. TABLEAU D'HUMEUR ─────────────────────────────────

CREATE TABLE IF NOT EXISTS mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'neutral', 'bad', 'awful')),
  emoji TEXT NOT NULL,
  note TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, date)
);

ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood_entries_household" ON mood_entries FOR ALL USING (
  household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
);

-- ── ENABLE REALTIME ──────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE meal_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE chore_rotations;
ALTER PUBLICATION supabase_realtime ADD TABLE chore_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_timers;
ALTER PUBLICATION supabase_realtime ADD TABLE mood_entries;

-- ── INDEXES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_meal_plans_household_date ON meal_plans(household_id, date);
CREATE INDEX IF NOT EXISTS idx_chore_rotations_household ON chore_rotations(household_id);
CREATE INDEX IF NOT EXISTS idx_polls_household ON polls(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_household ON documents(household_id, category);
CREATE INDEX IF NOT EXISTS idx_shared_timers_household ON shared_timers(household_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_household_date ON mood_entries(household_id, date DESC);
