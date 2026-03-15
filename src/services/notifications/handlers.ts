import notifee, { EventType } from '@notifee/react-native';
import { Linking } from 'react-native';
import { navigationRef } from './navigationRef';

// ─── Helpers de navigation ───────────────────────────────

function navigate(screen: string, params?: Record<string, unknown>): void {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(screen, params);
  }
}

function navigateToTab(tabName: string): void {
  navigate('Main', { screen: tabName });
}

function navigateByType(
  type: string | undefined,
  _data: Record<string, unknown> | undefined,
): void {
  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_COMPLETED_PARTNER':
    case 'TASK_REMINDER_MORNING':
    case 'TASK_REMINDER_EVENING':
    case 'TASK_OVERDUE':
    case 'TASK_STREAK':
      navigateToTab('Tasks');
      break;
    case 'EVENT_CREATED':
    case 'EVENT_REMINDER_24H':
    case 'EVENT_REMINDER_1H':
    case 'EVENT_TODAY':
    case 'EVENT_BIRTHDAY_TODAY':
      navigateToTab('Events');
      break;
    case 'FOOD_EXPIRY_TOMORROW':
    case 'FOOD_EXPIRY_TODAY':
    case 'FOOD_ALREADY_EXPIRED':
    case 'FOOD_ADDED_PARTNER':
    case 'FOOD_WEEKLY_WASTE_REPORT':
      navigateToTab('Food');
      break;
    case 'SHOPPING_ITEM_ADDED':
    case 'SHOPPING_ITEM_CHECKED':
    case 'SHOPPING_LIST_COMPLETE':
    case 'SHOPPING_DLC_SUGGESTION':
      navigateToTab('Shopping');
      break;
    case 'HOUSEHOLD_WEEKLY_RECAP':
    case 'HOUSEHOLD_MONTHLY_STATS':
      navigateToTab('Stats');
      break;
    default:
      navigateToTab('Calendar');
      break;
  }
}

// ─── Action handler ──────────────────────────────────────

const handleNotificationAction = (
  notification: Record<string, unknown> | undefined,
  actionId?: string,
): void => {
  if (!notification) return;
  const data = (notification.data ?? {}) as Record<string, string>;
  const { type, eventLocation } = data;

  const actions: Record<string, () => void> = {
    default: () => navigateByType(type, data),

    // Tâches
    open_tasks: () => navigateToTab('Tasks'),
    view_task: () => navigateToTab('Tasks'),
    accept_task: () => navigateToTab('Tasks'),
    open_task: () => navigateToTab('Tasks'),
    react_task_done: () => navigateToTab('Tasks'),
    delete_task: () => navigateToTab('Tasks'),
    postpone_tasks: () => navigateToTab('Tasks'),

    // Événements
    view_event: () => navigateToTab('Events'),
    open_maps: () => {
      if (eventLocation) {
        const encoded = encodeURIComponent(eventLocation);
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
      }
    },

    // Aliments
    open_food: () => navigateToTab('Food'),
    mark_consumed: () => navigateToTab('Food'),
    mark_wasted: () => navigateToTab('Food'),
    add_to_shopping: () => navigateToTab('Shopping'),

    // Courses
    open_shopping: () => navigateToTab('Shopping'),
    add_suggested_item: () => navigateToTab('Shopping'),

    // Système
    open_store: () => {
      Linking.openURL('https://play.google.com/store/apps/details?id=com.majordhome');
    },
    dismiss: () => {
      if (notification.id) {
        notifee.cancelNotification(notification.id as string);
      }
    },
  };

  const action = actions[actionId ?? 'default'];
  if (action) action();
};

// ─── Setup des handlers (appeler dans App.tsx) ───────────

export const setupNotificationHandlers = (): void => {
  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      handleNotificationAction(
        detail.notification as Record<string, unknown> | undefined,
        detail.pressAction?.id,
      );
    }
  });

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      handleNotificationAction(
        detail.notification as Record<string, unknown> | undefined,
        detail.pressAction?.id,
      );
    }
  });
};
