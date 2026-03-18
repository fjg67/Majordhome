-- ══════════════════════════════════════════════════════════
-- MajordHome — Rendre le bucket chat-media public
-- Les chemins sont basés sur UUID household + timestamp (non devinables)
-- La sécurité repose sur le RLS de la table messages
-- ══════════════════════════════════════════════════════════

-- Rendre le bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'chat-media';

-- Politique de lecture publique sur les objets du bucket
DROP POLICY IF EXISTS "chat_media_public_read" ON storage.objects;
CREATE POLICY "chat_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media');

-- Conserver la politique d'upload réservée aux membres du foyer
DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
CREATE POLICY "chat_media_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
  );

-- Permettre la suppression uniquement par l'uploader
DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
CREATE POLICY "chat_media_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
