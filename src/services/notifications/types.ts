// ─── Types du système de notifications MajordHome ────────

export type NotificationType =
  // Tâches
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED_PARTNER'
  | 'TASK_REMINDER_MORNING'
  | 'TASK_REMINDER_EVENING'
  | 'TASK_OVERDUE'
  | 'TASK_STREAK'
  // Événements
  | 'EVENT_CREATED'
  | 'EVENT_REMINDER_24H'
  | 'EVENT_REMINDER_1H'
  | 'EVENT_TODAY'
  | 'EVENT_BIRTHDAY_TODAY'
  // Aliments / DLC
  | 'FOOD_EXPIRY_TOMORROW'
  | 'FOOD_EXPIRY_TODAY'
  | 'FOOD_ALREADY_EXPIRED'
  | 'FOOD_ADDED_PARTNER'
  | 'FOOD_WEEKLY_WASTE_REPORT'
  // Courses
  | 'SHOPPING_ITEM_ADDED'
  | 'SHOPPING_ITEM_CHECKED'
  | 'SHOPPING_LIST_COMPLETE'
  | 'SHOPPING_DLC_SUGGESTION'
  // Foyer
  | 'MEMBER_JOINED'
  | 'MEMBER_LEFT'
  | 'HOUSEHOLD_WEEKLY_RECAP'
  | 'HOUSEHOLD_MONTHLY_STATS'
  // Système
  | 'APP_UPDATE_AVAILABLE';

export interface NotificationPayload {
  type: NotificationType;
  householdId: string;
  triggeredBy?: string;
  triggeredByName?: string;
  triggeredByColor?: string;
  data?: Record<string, string | number | boolean | string[]>;
}

export interface ScheduledNotification {
  id: string;
  type: NotificationType;
  scheduledFor: Date;
  relatedId: string;
}

// Trigger data types for recurring notifications
export type TriggerDataType =
  | 'TRIGGER_MORNING_RECAP'
  | 'TRIGGER_EVENING_REMINDER'
  | 'TRIGGER_WEEKLY_RECAP'
  | 'TRIGGER_MONTHLY_STATS'
  | 'TRIGGER_FOOD_CHECK';

export interface NotificationConfig {
  title: string;
  body: string;
  channel: string;
  android?: {
    style?: {
      type: number;
      text?: string;
      lines?: string[];
      title?: string;
      summary?: string;
    };
    actions?: Array<{
      title: string;
      pressAction: { id: string };
    }>;
    color?: string;
    importance?: number;
  };
  ios?: {
    sound?: string;
    badge?: number;
  };
  data?: Record<string, string | number | boolean>;
}
