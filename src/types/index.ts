// ─── Household ────────────────────────────────────────────
export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

// ─── Member ──────────────────────────────────────────────
export type MemberRole = 'admin' | 'member';

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string;
  color: string;
  avatar_emoji: string;
  role: MemberRole;
  joined_at: string;
}

// ─── Event ───────────────────────────────────────────────
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';
export type EventCategory = 'birthday' | 'work' | 'health' | 'family' | 'sport' | 'other';

export interface CalendarEvent {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  color: string | null;
  is_all_day: boolean;
  recurrence: RecurrenceType;
  category: EventCategory;
  location: string | null;
  assigned_members?: string[];
  created_at: string;
}

// ─── Task ────────────────────────────────────────────────
export type Priority = 'low' | 'medium' | 'high';
export type TaskCategory = 'cleaning' | 'cooking' | 'shopping' | 'general';

export interface Task {
  id: string;
  household_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_date: string;
  completed_at: string | null;
  completed_by: string | null;
  priority: Priority;
  category: TaskCategory;
  created_at: string;
}

// ─── Food Item ───────────────────────────────────────────
export type FoodCategory = 'dairy' | 'meat' | 'vegetables' | 'fruits' | 'frozen' | 'other';

export interface FoodItem {
  id: string;
  household_id: string;
  added_by: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  expiry_date: string;
  category: FoodCategory;
  consumed_at: string | null;
  created_at: string;
}

export type ExpiryStatus = 'expired' | 'urgent' | 'warning' | 'ok';

// ─── Shopping Item ───────────────────────────────────────
export interface ShoppingItem {
  id: string;
  household_id: string;
  added_by: string;
  name: string;
  quantity: string | null;
  category: string;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
}

// ─── Stats ───────────────────────────────────────────────
export interface TaskStats {
  user_id: string;
  display_name: string;
  color: string;
  completed_count: number;
  total_count: number;
}

export type StatsPeriod = 'week' | 'month' | '3months';

// ─── Realtime Payload ────────────────────────────────────
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload<T> {
  eventType: RealtimeEventType;
  new: T;
  old: Partial<T>;
}

// ─── Auth ────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
}

// ─── Expense / Budget ────────────────────────────────────
export type ExpenseCategory = 'food' | 'transport' | 'housing' | 'health' | 'leisure' | 'shopping' | 'bills' | 'other';
export type SplitMode = 'equal' | 'custom' | 'payer_only';

export interface Expense {
  id: string;
  household_id: string;
  paid_by: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  split_mode: SplitMode;
  split_members: string[];
  note: string | null;
  expense_date: string;
  created_at: string;
}

// ─── Chat Message (legacy — chat_messages table) ─────────
export type MessageType = 'text' | 'emoji' | 'system';

export interface ChatMessage {
  id: string;
  household_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  reply_to: string | null;
  edited_at: string | null;
  created_at: string;
}

// ─── Chat Message (new — messages table) ─────────────────
export type ChatMessageType = 'text' | 'image' | 'audio' | 'system';

export interface ChatMessageV2 {
  id: string;
  household_id: string;
  sender_id: string | null;
  type: ChatMessageType;
  content: string | null;
  media_url: string | null;
  media_thumb: string | null;
  audio_duration: number | null;
  reply_to_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

// ─── Note ────────────────────────────────────────────────
export type NoteCategory = 'memo' | 'recette' | 'contact' | 'code' | 'liste' | 'idee' | 'autre';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  order: number;
}

export interface NoteContactData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
}

export interface NoteRecipeData {
  portions: number;
  prepTime: number;
  cookTime: number;
  ingredients: string[];
  steps: string[];
}

export interface Note {
  id: string;
  household_id: string;
  created_by: string;
  last_edited_by: string | null;
  title: string;
  content: string | null;
  category: NoteCategory;
  accent_color: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  checklist: ChecklistItem[] | null;
  contact_data: NoteContactData | null;
  recipe_data: NoteRecipeData | null;
  attachments: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const NOTE_CATEGORY_CONFIG: Record<NoteCategory, {
  label: string; emoji: string; color: string; description: string;
}> = {
  memo:    { label: 'Mémo',    emoji: '📝', color: '#F5A623', description: 'Notes libres' },
  recette: { label: 'Recette', emoji: '🍳', color: '#34D399', description: 'Recettes de cuisine' },
  contact: { label: 'Contact', emoji: '📋', color: '#4ECDC4', description: 'Coordonnées utiles' },
  code:    { label: 'Code',    emoji: '🔑', color: '#A78BFA', description: 'Codes & mots de passe' },
  liste:   { label: 'Liste',   emoji: '✅', color: '#FF6B6B', description: 'Listes à cocher' },
  idee:    { label: 'Idée',    emoji: '💡', color: '#FFD700', description: 'Idées & projets' },
  autre:   { label: 'Autre',   emoji: '📦', color: 'rgba(255,255,255,0.45)', description: 'Autres notes' },
};

// ─── Gamification ────────────────────────────────────────
export interface MemberPoints {
  id: string;
  household_id: string;
  member_id: string;
  points: number;
  level: number;
  streak_days: number;
  longest_streak: number;
  last_activity_date: string | null;
  created_at: string;
}

export interface MemberBadge {
  id: string;
  household_id: string;
  member_id: string;
  badge_key: string;
  earned_at: string;
}

export interface PointHistory {
  id: string;
  household_id: string;
  member_id: string;
  points: number;
  reason: string;
  related_id: string | null;
  created_at: string;
}

// ─── Meal Planning ───────────────────────────────────────
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealPlan {
  id: string;
  household_id: string;
  date: string;
  meal_type: MealType;
  title: string;
  description: string | null;
  recipe_note_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MealPlanIngredient {
  id: string;
  meal_plan_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  created_at: string;
}

// ─── Chore Rotations ────────────────────────────────────
export type ChoreFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type ChoreRotationType = 'round_robin' | 'least_done' | 'random';
export type ChoreCategory = 'menage' | 'cuisine' | 'exterieur' | 'commun' | 'animaux' | 'autre';

export interface ChoreRotation {
  id: string;
  household_id: string;
  title: string;
  emoji: string;
  frequency: ChoreFrequency;
  member_order: string[];
  current_index: number;
  last_rotated_at: string;
  next_rotation_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChoreCompletion {
  id: string;
  rotation_id: string;
  member_id: string;
  completed_at: string;
  note: string | null;
}

// Enhanced chore types (v2 schema)
export interface Chore {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: ChoreCategory;
  frequency: ChoreFrequency;
  frequency_day: number | null;
  rotation_type: ChoreRotationType;
  rotation_members: string[];
  current_assignee_index: number;
  is_active: boolean;
  is_paused: boolean;
  duration_min: number;
  created_at: string;
  updated_at: string;
}

export interface ChoreOccurrence {
  id: string;
  chore_id: string;
  household_id: string;
  assigned_to: string;
  due_date: string;
  completed_at: string | null;
  completed_by: string | null;
  was_skipped: boolean;
  skip_reason: string | null;
  swapped_with: string | null;
  created_at: string;
}

export const CHORE_CATEGORY_CONFIG: Record<ChoreCategory, { label: string; emoji: string; color: string }> = {
  menage:    { label: 'Ménage',    emoji: '🧹', color: '#4ECDC4' },
  cuisine:   { label: 'Cuisine',   emoji: '🍳', color: '#FF6B6B' },
  exterieur: { label: 'Extérieur', emoji: '🌿', color: '#34D399' },
  commun:    { label: 'Commun',    emoji: '🏠', color: '#A78BFA' },
  animaux:   { label: 'Animaux',   emoji: '🐾', color: '#FFA07A' },
  autre:     { label: 'Autre',     emoji: '⚡', color: '#F5A623' },
};

export const CHORE_FREQUENCY_LABELS: Record<ChoreFrequency, string> = {
  daily:    'Tous les jours',
  weekly:   'Chaque semaine',
  biweekly: 'Toutes les 2 semaines',
  monthly:  'Chaque mois',
};

// ─── Polls / Votes ──────────────────────────────────────
export interface Poll {
  id: string;
  household_id: string;
  created_by: string | null;
  question: string;
  emoji: string;
  is_multiple_choice: boolean;
  is_anonymous: boolean;
  closes_at: string | null;
  is_closed: boolean;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  member_id: string;
  created_at: string;
}

// ─── Documents ──────────────────────────────────────────
export type DocumentCategory = 'invoice' | 'contract' | 'receipt' | 'medical' | 'insurance' | 'identity' | 'other';
export type DocCategory = 'facture' | 'contrat' | 'quittance' | 'ordonnance' | 'assurance' | 'impot' | 'photo' | 'autre';
export type FileType = 'pdf' | 'image' | 'doc' | 'other';

export interface HouseholdDocument {
  id: string;
  household_id: string;
  uploaded_by: string | null;
  title: string;
  description: string | null;
  category: DocumentCategory;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  tags: string[];
  created_at: string;
}

// Enhanced document type (v2)
export interface HouseholdDocumentV2 {
  id: string;
  household_id: string;
  uploaded_by: string;
  title: string;
  file_url: string;
  thumbnail_url: string | null;
  file_type: FileType;
  file_size: number;
  file_name: string;
  mime_type: string | null;
  category: DocCategory;
  description: string | null;
  tags: string[];
  is_important: boolean;
  is_shared: boolean;
  document_date: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export const DOC_CATEGORY_CONFIG: Record<DocCategory, { label: string; emoji: string; color: string; description: string }> = {
  facture:    { label: 'Factures',   emoji: '🧾', color: '#F5A623',              description: 'EDF, eau, internet...' },
  contrat:    { label: 'Contrats',   emoji: '📋', color: '#4ECDC4',              description: 'Bail, assurance...' },
  quittance:  { label: 'Quittances', emoji: '🏠', color: '#34D399',              description: 'Loyer, charges...' },
  ordonnance: { label: 'Santé',      emoji: '💊', color: '#FF6B6B',              description: 'Ordonnances, résultats...' },
  assurance:  { label: 'Assurances', emoji: '🛡️', color: '#A78BFA',             description: 'Attestations, polices...' },
  impot:      { label: 'Impôts',     emoji: '📊', color: '#FFD700',              description: 'Déclarations, avis...' },
  photo:      { label: 'Photos',     emoji: '📷', color: '#FFA07A',              description: 'Souvenirs importants...' },
  autre:      { label: 'Autre',      emoji: '📦', color: 'rgba(255,255,255,0.45)', description: 'Autres documents...' },
};

export const FILE_TYPE_CONFIG: Record<FileType, { label: string; color: string }> = {
  pdf:   { label: 'PDF',   color: '#FF6B6B' },
  image: { label: 'IMG',   color: '#4ECDC4' },
  doc:   { label: 'DOC',   color: '#A78BFA' },
  other: { label: 'FILE',  color: '#F5A623' },
};

// ─── Shared Timers ──────────────────────────────────────
export interface SharedTimer {
  id: string;
  household_id: string;
  created_by: string | null;
  label: string;
  emoji: string;
  duration_seconds: number;
  started_at: string | null;
  is_running: boolean;
  is_finished: boolean;
  created_at: string;
}

// ─── Rewards / Gamification ─────────────────────────────
export type BadgeRarity   = 'common' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'tasks' | 'streak' | 'special' | 'social';

export interface PlayerStatsV2 {
  rank: number;
  userId: string;
  displayName: string;
  color: string;
  avatarEmoji: string;
  totalXp: number;
  level: number;
  currentStreak: number;
  bestStreak: number;
  badgesCount: number;
  tasksCompleted: number;
  isMe: boolean;
  levelLabel: string;
  levelColor: string;
  levelEmoji: string;
  xpToNextLevel: number;
  xpCurrentLevelStart: number;
  xpProgress: number;
}

export interface BadgeV2 {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  xpReward: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  rarityColor: string;
  rarityLabel: string;
}

export interface XpEventV2 {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  actionType: string;
  xpEarned: number;
  description: string;
  createdAt: string;
}

export const REWARD_LEVELS = [
  { level: 0, label: 'Débutant',  xpRequired: 0,    color: '#C0C0C0', emoji: '🌱' },
  { level: 1, label: 'Apprenti',  xpRequired: 100,  color: '#F5A623', emoji: '⭐' },
  { level: 2, label: 'Confirmé',  xpRequired: 300,  color: '#34D399', emoji: '💪' },
  { level: 3, label: 'Expert',    xpRequired: 600,  color: '#4ECDC4', emoji: '🎯' },
  { level: 4, label: 'Maître',    xpRequired: 1000, color: '#A78BFA', emoji: '👑' },
  { level: 5, label: 'Légende',   xpRequired: 2000, color: '#FFD700', emoji: '🔥' },
];

export const BADGE_RARITY_CONFIG: Record<BadgeRarity, { label: string; color: string }> = {
  common:    { label: 'Commun',     color: '#C0C0C0' },
  rare:      { label: 'Rare',       color: '#4ECDC4' },
  epic:      { label: 'Épique',     color: '#A78BFA' },
  legendary: { label: 'Légendaire', color: '#FFD700' },
};

// ─── Timers V2 ──────────────────────────────────────────
export type TimerStatus   = 'ready' | 'running' | 'paused' | 'finished';
export type TimerCategory = 'cuisine' | 'lessive' | 'menage' | 'sport' | 'bricolage' | 'autre';

export interface TimerV2 {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  category: TimerCategory;
  duration_sec: number;
  status: TimerStatus;
  started_at: string | null;
  paused_at: string | null;
  elapsed_sec: number;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export const TIMER_CATEGORY_CONFIG: Record<TimerCategory, { label: string; emoji: string; color: string }> = {
  cuisine:   { label: 'Cuisine',   emoji: '🍳', color: '#FF6B6B' },
  lessive:   { label: 'Lessive',   emoji: '👕', color: '#4ECDC4' },
  menage:    { label: 'Ménage',    emoji: '🧹', color: '#A78BFA' },
  sport:     { label: 'Sport',     emoji: '🏃', color: '#34D399' },
  bricolage: { label: 'Bricolage', emoji: '🔧', color: '#FFA07A' },
  autre:     { label: 'Autre',     emoji: '⏱️', color: '#F5A623' },
};

// ─── Mood Board (legacy) ─────────────────────────────────
export type MoodLevel = 'great' | 'good' | 'neutral' | 'bad' | 'awful';

export interface MoodEntry {
  id: string;
  household_id: string;
  member_id: string;
  mood: MoodLevel;
  emoji: string;
  note: string | null;
  date: string;
  created_at: string;
}

// ─── Mood Board V2 ────────────────────────────────────────
export type MoodValue = 'super' | 'bien' | 'neutre' | 'bof' | 'mauvais';

export interface MoodConfig {
  value: MoodValue;
  label: string;
  emoji: string;
  color: string;
  score: number;
  description: string;
}

export const MOOD_CONFIGS: MoodConfig[] = [
  { value: 'super',   label: 'Super',   emoji: '😄', color: '#FFD700', score: 5, description: 'Excellent ! Tu rayonnes 🌟' },
  { value: 'bien',    label: 'Bien',    emoji: '😊', color: '#34D399', score: 4, description: 'Bonne journée ✨' },
  { value: 'neutre',  label: 'Neutre',  emoji: '😐', color: '#F5A623', score: 3, description: 'Journée ordinaire' },
  { value: 'bof',     label: 'Bof',     emoji: '😕', color: '#FF8C00', score: 2, description: 'Pas au top...' },
  { value: 'mauvais', label: 'Mauvais', emoji: '😢', color: '#FF6B6B', score: 1, description: "Difficile aujourd'hui 💙" },
];

export interface DailyMoodV2 {
  id: string;
  householdId: string;
  userId: string;
  userName: string;
  userColor: string;
  userEmoji: string;
  mood: MoodValue;
  moodDate: string;
  note?: string;
  isNoteShared: boolean;
  createdAt: string;
}

export interface WeekMoodData {
  userId: string;
  userName: string;
  userColor: string;
  userEmoji: string;
  days: Record<string, MoodValue | null>;
}

export interface MoodStat {
  mood: MoodValue;
  count: number;
  pct: number;
  avgScore: number;
}

export interface AppState {
  user: AuthUser | null;
  household: Household | null;
  member: HouseholdMember | null;
  members: HouseholdMember[];
  isLoading: boolean;
}
