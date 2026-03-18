import { create } from 'zustand';
import { supabase } from '@services/supabase';
import type {
  AuthUser,
  Household,
  HouseholdMember,
} from '@appTypes/index';

interface AuthState {
  user: AuthUser | null;
  household: Household | null;
  member: HouseholdMember | null;
  members: HouseholdMember[];
  isLoading: boolean;
  isAuthenticated: boolean;
  hasHousehold: boolean;
  hasProfile: boolean;

  // Actions
  initialize: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  sendMagicLink: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  loadHousehold: () => Promise<void>;
  createHousehold: (name: string) => Promise<{ error: string | null }>;
  joinHousehold: (inviteCode: string) => Promise<{ error: string | null }>;
  updateProfile: (data: {
    displayName: string;
    color: string;
    avatarEmoji: string;
  }) => Promise<{ error: string | null }>;
  addFamilyMember: (data: {
    displayName: string;
    color: string;
    avatarEmoji: string;
  }) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  household: null,
  member: null,
  members: [],
  isLoading: true,
  isAuthenticated: false,
  hasHousehold: false,
  hasProfile: false,

  initialize: async () => {
    set({ isLoading: true });

    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('INIT_TIMEOUT')), 15000),
      );

      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

      if (!session?.user) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Vérifier que l'utilisateur existe encore côté serveur
      const { data: { user: serverUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !serverUser) {
        // Session locale invalide — déconnecter
        await supabase.auth.signOut();
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user: AuthUser = {
        id: serverUser.id,
        email: serverUser.email ?? '',
      };

      set({ user, isAuthenticated: true });

      // Charger le foyer (avec timeout)
      try {
        await Promise.race([
          get().loadHousehold(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('HOUSEHOLD_TIMEOUT')), 10000),
          ),
        ]);
      } catch (_e) {
        // Household loading failed/timed out — continue anyway
      }

      set({ isLoading: false });

      // Écouter les changements d'auth
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.user) {
          const u: AuthUser = {
            id: newSession.user.id,
            email: newSession.user.email ?? '',
          };
          set({ user: u, isAuthenticated: true });
          try { await get().loadHousehold(); } catch (_e) { /* ignore */ }
        } else {
          set({
            user: null,
            household: null,
            member: null,
            members: [],
            isAuthenticated: false,
            hasHousehold: false,
            hasProfile: false,
          });
        }
      });
    } catch (_e) {
      // Network error or timeout — send user to Auth screen
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  setUser: (user) =>
    set({ user, isAuthenticated: user !== null }),

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    
    if (data.session?.user) {
      const user: AuthUser = {
        id: data.session.user.id,
        email: data.session.user.email ?? '',
      };
      set({ user, isAuthenticated: true });
    }
    return { error: null };
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    // If Supabase returns a session, user is auto-confirmed
    if (data.session?.user) {
      const user: AuthUser = {
        id: data.session.user.id,
        email: data.session.user.email ?? '',
      };
      set({ user, isAuthenticated: true });
      return { error: null };
    }

    // No session = email confirmation required or user already exists
    return { error: '__EMAIL_CONFIRM__' };
  },

  sendMagicLink: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) return { error: error.message };
    return { error: null };
  },

  verifyOtp: async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) return { error: error.message };

    if (data.session?.user) {
      const user: AuthUser = {
        id: data.session.user.id,
        email: data.session.user.email ?? '',
      };
      set({ user, isAuthenticated: true });
    }
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      household: null,
      member: null,
      members: [],
      isAuthenticated: false,
      hasHousehold: false,
      hasProfile: false,
    });
  },

  loadHousehold: async () => {
    const { user } = get();
    if (!user) return;

    // Étape 1 : récupérer le membership de l'utilisateur
    const { data: memberData, error: memberError } = await supabase
      .from('household_members')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (memberError || !memberData) {
      console.warn('[loadHousehold] pas de membership:', memberError?.message);
      set({ hasHousehold: false, hasProfile: false });
      return;
    }

    // Étape 2 : récupérer le foyer séparément (évite les erreurs de FK join)
    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .select('*')
      .eq('id', memberData.household_id)
      .single();

    if (householdError || !householdData) {
      console.warn('[loadHousehold] foyer introuvable:', householdError?.message);
      set({ hasHousehold: false, hasProfile: false });
      return;
    }

    const household = householdData as Household;
    const member: HouseholdMember = {
      id: memberData.id,
      household_id: memberData.household_id,
      user_id: memberData.user_id,
      display_name: memberData.display_name,
      color: memberData.color,
      avatar_emoji: memberData.avatar_emoji,
      role: memberData.role,
      joined_at: memberData.joined_at,
    };

    // Étape 3 : charger tous les membres du foyer
    const { data: allMembers } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', household.id);

    set({
      household,
      member,
      members: (allMembers ?? []) as HouseholdMember[],
      hasHousehold: true,
      hasProfile: !!member.display_name,
    });
  },

  createHousehold: async (name) => {
    const { user } = get();
    if (!user) return { error: 'Non authentifié' };

    // Utiliser la fonction RPC qui contourne le RLS
    const { error } = await supabase.rpc('create_household_with_member', {
      p_name: name,
    });

    if (error) return { error: error.message };

    await get().loadHousehold();
    return { error: null };
  },

  joinHousehold: async (inviteCode) => {
    const { user } = get();
    if (!user) return { error: 'Non authentifié' };

    // Appel RPC SECURITY DEFINER (contourne la RLS)
    const { error: rpcError } = await supabase
      .rpc('join_household_by_code', { p_invite_code: inviteCode.trim() });

    if (rpcError) {
      return { error: rpcError.message.includes('invalide')
        ? 'Code d\'invitation invalide'
        : rpcError.message };
    }

    await get().loadHousehold();
    return { error: null };
  },

  updateProfile: async ({ displayName, color, avatarEmoji }) => {
    const { member } = get();
    if (!member) return { error: 'Pas de profil' };

    const { error } = await supabase
      .from('household_members')
      .update({
        display_name: displayName,
        color,
        avatar_emoji: avatarEmoji,
      })
      .eq('id', member.id);

    if (error) return { error: error.message };

    set({
      member: { ...member, display_name: displayName, color, avatar_emoji: avatarEmoji },
      hasProfile: true,
    });
    return { error: null };
  },

  addFamilyMember: async ({ displayName, color, avatarEmoji }) => {
    const { household } = get();
    if (!household) return { error: 'Pas de foyer' };

    const { error } = await supabase.rpc('add_family_member', {
      p_household_id: household.id,
      p_display_name: displayName,
      p_color: color,
      p_avatar_emoji: avatarEmoji,
    });

    if (error) return { error: error.message };

    // Recharger les membres
    await get().loadHousehold();
    return { error: null };
  },
}));
