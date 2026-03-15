import { createClient } from '@supabase/supabase-js';
import { MMKV } from 'react-native-mmkv';
import { nativeFetch } from './nativeFetch';

// ─── MMKV Storage adapter pour Supabase Auth ─────────────
const storage = new MMKV({ id: 'majordhome-auth' });

const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    return storage.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
};

// ─── Supabase Client ────────────────────────────────────
const SUPABASE_URL = 'https://yxqsgqbrzesmnpughynd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4cXNncWJyemVzbW5wdWdoeW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MDc4NDAsImV4cCI6MjA4ODk4Mzg0MH0.nqhxrNaDPDOidRcYoaeeZK_qYL3zeioVqEPci9nM9co';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: nativeFetch as unknown as typeof fetch,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ─── Helper : souscription Realtime par table + household ─
export const subscribeToTable = (
  table: string,
  householdId: string,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void,
) => {
  const channel = supabase
    .channel(`${table}-${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: (payload.new ?? {}) as Record<string, unknown>,
          old: (payload.old ?? {}) as Record<string, unknown>,
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
