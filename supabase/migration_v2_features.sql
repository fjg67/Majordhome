-- ═══════════════════════════════════════════════════════════
-- MajordHome v2 — Budget, Chat, Notes, Gamification
-- ═══════════════════════════════════════════════════════════

-- ─── BUDGET / DÉPENSES ───────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  paid_by TEXT NOT NULL,         -- member.id
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT DEFAULT 'other', -- food, transport, housing, health, leisure, shopping, bills, other
  split_mode TEXT DEFAULT 'equal', -- equal, custom, payer_only
  split_members TEXT[] DEFAULT '{}', -- member ids involved (empty = all)
  note TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_expenses" ON expenses;
CREATE POLICY "household_expenses" ON expenses FOR ALL
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

-- ─── CHAT / MESSAGES ────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  sender_id TEXT NOT NULL,       -- member.id
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, emoji, system
  reply_to UUID REFERENCES chat_messages(id),
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_chat" ON chat_messages;
CREATE POLICY "household_chat" ON chat_messages FOR ALL
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

-- Index for fast loading
CREATE INDEX IF NOT EXISTS idx_chat_messages_household_created
  ON chat_messages (household_id, created_at DESC);

-- ─── NOTES PARTAGÉES ────────────────────────────────────

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by TEXT NOT NULL,      -- member.id
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'memo',  -- memo, recipe, contact, code, list, other
  color TEXT DEFAULT '#F5A623',
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_notes" ON notes;
CREATE POLICY "household_notes" ON notes FOR ALL
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

-- ─── GAMIFICATION / RÉCOMPENSES ─────────────────────────

CREATE TABLE IF NOT EXISTS member_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  member_id TEXT NOT NULL,       -- member.id
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, member_id)
);

ALTER TABLE member_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_points" ON member_points;
CREATE POLICY "household_points" ON member_points FOR ALL
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  member_id TEXT NOT NULL,
  badge_key TEXT NOT NULL,       -- first_task, streak_7, streak_30, chef, shopper, etc.
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id, member_id, badge_key)
);

ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_badges" ON member_badges;
CREATE POLICY "household_badges" ON member_badges FOR ALL
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS point_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  member_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,          -- task_completed, event_created, shopping_done, streak_bonus, etc.
  related_id UUID,               -- task/event/food id
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE point_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "household_point_history" ON point_history;
CREATE POLICY "household_point_history" ON point_history FOR ALL
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

-- ─── REALTIME ────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE member_points;
