-- ══════════════════════════════════════════════════════════════
-- MAJORDHOME — Chat / Messagerie Feature
-- Migration SQL — Supabase
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════
-- TABLE MESSAGES
-- ══════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES household_members(id) ON DELETE SET NULL,

  -- Contenu
  type          TEXT NOT NULL DEFAULT 'text',
  -- 'text' | 'image' | 'audio' | 'system'

  content       TEXT,
  -- texte si type='text' / caption si type='image'
  -- description si type='system' (ex: "Eva a rejoint le foyer")

  media_url     TEXT,
  -- URL Supabase Storage si type='image' ou 'audio'

  media_thumb   TEXT,
  -- Thumbnail URL pour les images

  audio_duration INTEGER,
  -- Durée en secondes si type='audio'

  -- Réponse à un message
  reply_to_id   UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Statuts
  is_edited     BOOLEAN DEFAULT false,
  edited_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,  -- soft delete

  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════
-- TABLE RÉACTIONS
-- ══════════════════════════════════
CREATE TABLE IF NOT EXISTS message_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES household_members(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,  -- '❤️' '😂' '👍' '🔥' '😮' '😢'
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- ══════════════════════════════════
-- TABLE LECTURE (read receipts)
-- ══════════════════════════════════
CREATE TABLE IF NOT EXISTS message_reads (
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES household_members(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- ══════════════════════════════════
-- TABLE TYPING INDICATOR
-- ══════════════════════════════════
CREATE TABLE IF NOT EXISTS typing_indicators (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES household_members(id) ON DELETE CASCADE,
  is_typing    BOOLEAN DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- ══════════════════════════════════
-- INDEX PERFORMANCE
-- ══════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_messages_household_created
  ON messages(household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reactions_message
  ON message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_message_reads_message
  ON message_reads(message_id);

-- ══════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators  ENABLE ROW LEVEL SECURITY;

-- Messages : membres du foyer voient/créent/modifient
CREATE POLICY "household_messages_select" ON messages
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "household_messages_insert" ON messages
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "household_messages_update" ON messages
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- Réactions
CREATE POLICY "household_reactions_select" ON message_reactions
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM messages WHERE household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "household_reactions_insert" ON message_reactions
  FOR INSERT WITH CHECK (
    message_id IN (
      SELECT id FROM messages WHERE household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "household_reactions_delete" ON message_reactions
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- Message Reads
CREATE POLICY "household_reads_all" ON message_reads
  FOR ALL USING (
    message_id IN (
      SELECT id FROM messages WHERE household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Typing Indicators
CREATE POLICY "household_typing_all" ON typing_indicators
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- ══════════════════════════════════
-- SUPABASE STORAGE — Chat Media
-- ══════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- Policy : membres du foyer accèdent aux médias de leur foyer
CREATE POLICY "household_chat_media" ON storage.objects
  FOR ALL USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] IN (
      SELECT household_id::text FROM household_members
      WHERE user_id = auth.uid()
    )
  );

-- ══════════════════════════════════
-- ENABLE REALTIME
-- ══════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
