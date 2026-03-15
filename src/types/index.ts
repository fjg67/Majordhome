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
  user_id: string;
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

export interface AppState {
  user: AuthUser | null;
  household: Household | null;
  member: HouseholdMember | null;
  members: HouseholdMember[];
  isLoading: boolean;
}
