export { notificationService } from './NotificationService';
export { setupNotificationHandlers } from './handlers';
export { navigationRef } from './navigationRef';
export { createAllChannels, CHANNELS } from './channels';
export type {
  NotificationType,
  NotificationPayload,
  ScheduledNotification,
} from './types';

// Legacy re-exports (used by food features)
export {
  setupNotificationChannel,
  showNotification,
  scheduleNotification,
  scheduleExpiryNotification,
  scheduleTaskReminder,
  cancelNotification,
} from './legacy';
