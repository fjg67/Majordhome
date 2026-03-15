// Legacy notification helpers — kept for backward compatibility
// These are re-exported from the new notifications/index.ts

import notifee, {
  AndroidImportance,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';

export const setupNotificationChannel = async (): Promise<void> => {
  await notifee.createChannel({
    id: 'majordhome-default',
    name: 'Majordhome',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });

  await notifee.createChannel({
    id: 'majordhome-expiry',
    name: 'Alertes DLC',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });

  await notifee.createChannel({
    id: 'majordhome-tasks',
    name: 'Tâches',
    importance: AndroidImportance.DEFAULT,
  });
};

export const showNotification = async (
  title: string,
  body: string,
  channelId: string = 'majordhome-default',
): Promise<void> => {
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId,
      smallIcon: 'ic_notification',
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'default',
    },
  });
};

export const scheduleNotification = async (
  title: string,
  body: string,
  triggerDate: Date,
  channelId: string = 'majordhome-default',
  notifId?: string,
): Promise<string> => {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerDate.getTime(),
  };

  const id = await notifee.createTriggerNotification(
    {
      id: notifId,
      title,
      body,
      android: {
        channelId,
        smallIcon: 'ic_notification',
        pressAction: { id: 'default' },
      },
      ios: {
        sound: 'default',
      },
    },
    trigger,
  );

  return id;
};

export const scheduleExpiryNotification = async (
  foodName: string,
  expiryDate: Date,
  foodId: string,
): Promise<string> => {
  const notifDate = new Date(expiryDate);
  notifDate.setDate(notifDate.getDate() - 1);
  notifDate.setHours(10, 0, 0, 0);

  if (notifDate.getTime() <= Date.now()) {
    return '';
  }

  return scheduleNotification(
    '⚠️ Expiration proche',
    `${foodName} expire demain !`,
    notifDate,
    'majordhome-expiry',
    `food-expiry-${foodId}`,
  );
};

export const scheduleTaskReminder = async (
  taskTitle: string,
  dueDate: Date,
  taskId: string,
): Promise<string> => {
  const reminderDate = new Date(dueDate);
  reminderDate.setHours(20, 0, 0, 0);

  if (reminderDate.getTime() <= Date.now()) {
    return '';
  }

  return scheduleNotification(
    '📋 Tâche en attente',
    `N'oublie pas : ${taskTitle}`,
    reminderDate,
    'majordhome-tasks',
    `task-reminder-${taskId}`,
  );
};

export const cancelNotification = async (notifId: string): Promise<void> => {
  await notifee.cancelNotification(notifId);
};
