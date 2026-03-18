-- ══════════════════════════════════════════════════════════
-- MajordHome — S'assurer que le bucket chat-media existe et est public
-- À exécuter dans Supabase SQL Editor si les images ne s'affichent pas
-- ══════════════════════════════════════════════════════════

-- 1. Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  52428800,  -- 50 MB max
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mp4', 'audio/m4a', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Politique de lecture publique (pas besoin d'auth)
DROP POLICY IF EXISTS "chat_media_public_read" ON storage.objects;
CREATE POLICY "chat_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media');

-- 3. Upload réservé aux membres authentifiés
DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
CREATE POLICY "chat_media_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
  );

-- 4. Mise à jour par l'uploader
DROP POLICY IF EXISTS "chat_media_update" ON storage.objects;
CREATE POLICY "chat_media_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
  );

-- 5. Suppression par l'uploader
DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
CREATE POLICY "chat_media_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
  );

-- Vérification
SELECT id, name, public FROM storage.buckets WHERE id = 'chat-media';
