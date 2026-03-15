import { Platform, PermissionsAndroid } from 'react-native';
import notifee, {
  AndroidImportance,
  TriggerType,
  RepeatFrequency,
  type TimestampTrigger,
} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

import { supabase } from '@services/supabase';
import { createAllChannels, CHANNELS } from './channels';
import { NOTIFICATION_TEMPLATES } from './templates';
import type { NotificationPayload } from './types';

dayjs.locale('fr');

// ─── Service principal de notifications (Singleton) ──────

class NotificationService {
  private static instance: NotificationService;
  private householdId: string | null = null;
  private userId: string | null = null;
  private realtimeSubscriptions: Array<{ unsubscribe: () => void }> = [];

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ── INITIALISATION ──────────────────

  async initialize(userId: string, householdId: string): Promise<void> {
    this.userId = userId;
    this.householdId = householdId;

    try {
      await createAllChannels();
    } catch (e) {
      console.warn('[NotificationService] Channel creation error:', e);
    }

    try {
      await this.requestPermissions();
    } catch (e) {
      console.warn('[NotificationService] Permission request error:', e);
    }

    try {
      await this.setupFCM();
    } catch (e) {
      console.warn('[NotificationService] FCM setup error (placeholder config?):', e);
    }

    try {
      await this.setupRealtimeListeners();
    } catch (e) {
      console.warn('[NotificationService] Realtime listeners error:', e);
    }

    try {
      await this.scheduleRecurringNotifications();
    } catch (e) {
      console.warn('[NotificationService] Recurring notifications error:', e);
    }

    try {
      await this.checkExpiredFoodOnLaunch();
    } catch (e) {
      console.warn('[NotificationService] Expired food check error:', e);
    }

    console.log('[NotificationService] Initialized ✓');
  }

  async cleanup(): Promise<void> {
    this.realtimeSubscriptions.forEach(sub => sub.unsubscribe());
    this.realtimeSubscriptions = [];
    await notifee.cancelAllNotifications();
  }

  // ── PERMISSIONS ─────────────────────

  async requestPermissions(): Promise<boolean> {
    // Android 13+ (API 33) requires POST_NOTIFICATIONS runtime permission
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[NotificationService] POST_NOTIFICATIONS permission denied');
        return false;
      }
    }

    const settings = await notifee.requestPermission({
      sound: true,
      alert: true,
      badge: true,
      provisional: false,
    });

    try {
      await messaging().requestPermission({
        alert: true,
        badge: true,
        sound: true,
        criticalAlert: false,
      });
    } catch (e) {
      console.warn('[NotificationService] FCM permission error:', e);
    }

    return settings.authorizationStatus >= 1;
  }

  // ── FCM SETUP ───────────────────────

  async setupFCM(): Promise<void> {
    try {
      const token = await messaging().getToken();
      if (token) {
        await supabase.from('device_tokens').upsert({
          user_id: this.userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        });
      }

      messaging().onTokenRefresh(async (newToken) => {
        await supabase.from('device_tokens').upsert({
          user_id: this.userId,
          token: newToken,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        });
      });

      messaging().onMessage(async (remoteMessage) => {
        if (remoteMessage.data?.type) {
          await this.displayNotification(
            remoteMessage.data as unknown as NotificationPayload,
          );
        }
      });

      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('[FCM] Background message:', remoteMessage.messageId);
      });
    } catch (e) {
      // FCM may fail with placeholder google-services.json — local notifications still work
      console.warn('[NotificationService] FCM setup failed (push notifications disabled):', e);
    }
  }

  // ── REALTIME SUPABASE ────────────────

  async setupRealtimeListeners(): Promise<void> {
    if (!this.householdId || !this.userId) return;

    // ── TÂCHES ──
    const tasksSub = supabase
      .channel('notif-tasks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `household_id=eq.${this.householdId}`,
        },
        async (payload) => {
          const task = payload.new as Record<string, string>;
          if (
            task.assigned_to === this.userId &&
            task.created_by !== this.userId
          ) {
            const creator = await this.getMemberName(task.created_by);
            await this.displayNotification({
              type: 'TASK_ASSIGNED',
              householdId: this.householdId!,
              triggeredBy: task.created_by,
              triggeredByName: creator,
              data: {
                taskId: task.id,
                taskTitle: task.title,
                dueDate: dayjs(task.due_date).format('ddd D MMM'),
              },
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `household_id=eq.${this.householdId}`,
        },
        async (payload) => {
          const task = payload.new as Record<string, string | null>;
          const old = payload.old as Record<string, string | null>;
          if (
            task.completed_at &&
            !old.completed_at &&
            task.completed_by !== this.userId &&
            task.assigned_to === this.userId
          ) {
            const completer = await this.getMemberName(task.completed_by!);
            await this.displayNotification({
              type: 'TASK_COMPLETED_PARTNER',
              householdId: this.householdId!,
              triggeredByName: completer,
              data: { taskTitle: task.title ?? '' },
            });
          }
        },
      )
      .subscribe();

    // ── ÉVÉNEMENTS ──
    const eventsSub = supabase
      .channel('notif-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `household_id=eq.${this.householdId}`,
        },
        async (payload) => {
          const event = payload.new as Record<string, string>;
          if (event.created_by !== this.userId) {
            const creator = await this.getMemberName(event.created_by);
            await this.displayNotification({
              type: 'EVENT_CREATED',
              householdId: this.householdId!,
              triggeredByName: creator,
              data: {
                eventId: event.id,
                eventTitle: event.title,
                eventDate: dayjs(event.start_at).format('ddd D MMM à HH:mm'),
              },
            });
          }
          await this.scheduleEventReminders(event);
        },
      )
      .subscribe();

    // ── ALIMENTS ──
    const foodSub = supabase
      .channel('notif-food')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'food_items',
          filter: `household_id=eq.${this.householdId}`,
        },
        async (payload) => {
          const food = payload.new as Record<string, string>;
          if (food.added_by !== this.userId) {
            const adder = await this.getMemberName(food.added_by);
            await this.displayNotification({
              type: 'FOOD_ADDED_PARTNER',
              householdId: this.householdId!,
              triggeredByName: adder,
              data: {
                foodName: food.name,
                count: 1,
                expiryDate: dayjs(food.expiry_date).format('D MMM'),
              },
            });
          }
          await this.scheduleFoodExpiryReminder(food);
        },
      )
      .subscribe();

    // ── COURSES ──
    const shoppingSub = supabase
      .channel('notif-shopping')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shopping_items',
          filter: `household_id=eq.${this.householdId}`,
        },
        async (payload) => {
          const item = payload.new as Record<string, string>;
          if (item.added_by !== this.userId) {
            const adder = await this.getMemberName(item.added_by);
            await this.displayNotification({
              type: 'SHOPPING_ITEM_ADDED',
              householdId: this.householdId!,
              triggeredByName: adder,
              data: { itemName: item.name, count: 1 },
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shopping_items',
          filter: `household_id=eq.${this.householdId}`,
        },
        async (payload) => {
          const item = payload.new as Record<string, string | boolean | null>;
          const old = payload.old as Record<string, string | boolean | null>;
          if (
            item.checked &&
            !old.checked &&
            item.checked_by !== this.userId
          ) {
            const checker = await this.getMemberName(item.checked_by as string);
            const { count } = await supabase
              .from('shopping_items')
              .select('*', { count: 'exact', head: true })
              .eq('household_id', this.householdId!)
              .eq('checked', false);

            if (count === 0) {
              await this.displayNotification({
                type: 'SHOPPING_LIST_COMPLETE',
                householdId: this.householdId!,
                triggeredByName: checker,
                data: { totalCount: String(count) },
              });
            } else {
              await this.displayNotification({
                type: 'SHOPPING_ITEM_CHECKED',
                householdId: this.householdId!,
                triggeredByName: checker,
                data: {
                  itemName: item.name as string,
                  remainingCount: count ?? 0,
                },
              });
            }
          }
        },
      )
      .subscribe();

    // ── MEMBRES ──
    const membersSub = supabase
      .channel('notif-members')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'household_members',
          filter: `household_id=eq.${this.householdId}`,
        },
        async (payload) => {
          const member = payload.new as Record<string, string>;
          if (member.user_id !== this.userId) {
            const { data: household } = await supabase
              .from('households')
              .select('name')
              .eq('id', this.householdId!)
              .single();

            await this.displayNotification({
              type: 'MEMBER_JOINED',
              householdId: this.householdId!,
              data: {
                memberName: member.display_name,
                householdName: household?.name ?? 'Foyer',
              },
            });
          }
        },
      )
      .subscribe();

    this.realtimeSubscriptions = [
      tasksSub,
      eventsSub,
      foodSub,
      shoppingSub,
      membersSub,
    ];
  }

  // ── NOTIFICATIONS RÉCURRENTES PLANIFIÉES ──

  async scheduleRecurringNotifications(): Promise<void> {
    await notifee.cancelTriggerNotifications();

    await Promise.all([
      this.scheduleDailyMorningRecap(),
      this.scheduleDailyEveningReminder(),
      this.scheduleWeeklyRecap(),
      this.scheduleMonthlyStats(),
      this.scheduleDailyFoodCheck(),
    ]);
  }

  // Récap matin — chaque jour à 8h00
  private async scheduleDailyMorningRecap(): Promise<void> {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: dayjs()
        .hour(8)
        .minute(0)
        .second(0)
        .add(dayjs().hour() >= 8 ? 1 : 0, 'day')
        .valueOf(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: 'daily_morning_recap',
        title: '🌅 Programme du jour',
        body: 'Chargement de tes tâches...',
        android: {
          channelId: CHANNELS.RECAP.id,
          smallIcon: 'ic_notification',
          color: '#F5A623',
        },
        data: { type: 'TRIGGER_MORNING_RECAP' },
      },
      trigger,
    );
  }

  // Rappel soir — chaque jour à 20h00
  private async scheduleDailyEveningReminder(): Promise<void> {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: dayjs()
        .hour(20)
        .minute(0)
        .second(0)
        .add(dayjs().hour() >= 20 ? 1 : 0, 'day')
        .valueOf(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: 'daily_evening_reminder',
        title: '🌙 Fin de journée',
        body: 'Vérification des tâches...',
        android: {
          channelId: CHANNELS.TASKS.id,
          smallIcon: 'ic_notification',
          color: '#FF8C00',
        },
        data: { type: 'TRIGGER_EVENING_REMINDER' },
      },
      trigger,
    );
  }

  // Bilan hebdo — dimanche à 19h00
  private async scheduleWeeklyRecap(): Promise<void> {
    const nextSunday = dayjs().day(7).hour(19).minute(0).second(0);
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: nextSunday.valueOf(),
      repeatFrequency: RepeatFrequency.WEEKLY,
    };

    await notifee.createTriggerNotification(
      {
        id: 'weekly_recap',
        title: '📊 Bilan de la semaine',
        body: 'Calcul en cours...',
        android: {
          channelId: CHANNELS.RECAP.id,
          smallIcon: 'ic_notification',
          color: '#F5A623',
        },
        data: { type: 'TRIGGER_WEEKLY_RECAP' },
      },
      trigger,
    );
  }

  // Stats mensuelles — 1er du mois à 9h00
  private async scheduleMonthlyStats(): Promise<void> {
    const firstNextMonth = dayjs()
      .add(1, 'month')
      .date(1)
      .hour(9)
      .minute(0)
      .second(0);
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: firstNextMonth.valueOf(),
    };

    await notifee.createTriggerNotification(
      {
        id: 'monthly_stats',
        title: '🎯 Bilan du mois',
        body: 'Chargement...',
        android: {
          channelId: CHANNELS.RECAP.id,
          smallIcon: 'ic_notification',
          color: '#F5A623',
        },
        data: { type: 'TRIGGER_MONTHLY_STATS' },
      },
      trigger,
    );
  }

  // Check DLC — chaque jour à 9h30
  private async scheduleDailyFoodCheck(): Promise<void> {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: dayjs()
        .hour(9)
        .minute(30)
        .second(0)
        .add(dayjs().hour() >= 9 ? 1 : 0, 'day')
        .valueOf(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: 'daily_food_check',
        title: '🥑 Vérification DLC',
        body: 'Vérification...',
        android: {
          channelId: CHANNELS.FOOD.id,
          smallIcon: 'ic_notification',
        },
        data: { type: 'TRIGGER_FOOD_CHECK' },
      },
      trigger,
    );
  }

  // ── PLANIFICATION PAR ENTITÉ ──────────

  async scheduleEventReminders(event: Record<string, string>): Promise<void> {
    const startAt = dayjs(event.start_at);

    // Rappel J-1
    const reminder24h = startAt.subtract(24, 'hour');
    if (reminder24h.isAfter(dayjs())) {
      await notifee.createTriggerNotification(
        {
          id: `event_24h_${event.id}`,
          title: '📅 Rappel — demain',
          body: `"${event.title}" à ${startAt.format('HH:mm')}`,
          android: {
            channelId: CHANNELS.EVENTS.id,
            smallIcon: 'ic_notification',
            color: '#4ECDC4',
          },
          data: {
            type: 'EVENT_REMINDER_24H',
            eventId: event.id,
            eventTitle: event.title,
            eventTime: startAt.format('HH:mm'),
            eventLocation: event.location ?? '',
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: reminder24h.valueOf(),
        },
      );
    }

    // Rappel H-1
    const reminder1h = startAt.subtract(1, 'hour');
    if (reminder1h.isAfter(dayjs())) {
      await notifee.createTriggerNotification(
        {
          id: `event_1h_${event.id}`,
          title: '⏰ Dans 1 heure !',
          body: `"${event.title}"`,
          android: {
            channelId: CHANNELS.EVENTS.id,
            smallIcon: 'ic_notification',
            color: '#FF8C00',
            importance: AndroidImportance.HIGH,
          },
          data: {
            type: 'EVENT_REMINDER_1H',
            eventId: event.id,
            eventTitle: event.title,
            eventTime: startAt.format('HH:mm'),
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: reminder1h.valueOf(),
        },
      );
    }

    // Si anniversaire → rappel le matin à 8h
    if (event.category === 'birthday') {
      const birthdayMorning = startAt.hour(8).minute(0).second(0);
      if (birthdayMorning.isAfter(dayjs())) {
        await notifee.createTriggerNotification(
          {
            id: `event_birthday_${event.id}`,
            title: "🎂 Anniversaire aujourd'hui !",
            body: `N'oublie pas : "${event.title}"`,
            android: {
              channelId: CHANNELS.EVENTS.id,
              smallIcon: 'ic_notification',
              color: '#FF6B6B',
              importance: AndroidImportance.HIGH,
            },
            data: {
              type: 'EVENT_BIRTHDAY_TODAY',
              eventTitle: event.title,
            },
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: birthdayMorning.valueOf(),
          },
        );
      }
    }
  }

  async scheduleFoodExpiryReminder(food: Record<string, string>): Promise<void> {
    const expiryDate = dayjs(food.expiry_date);

    // Rappel la veille à 19h00
    const dayBefore = expiryDate
      .subtract(1, 'day')
      .hour(19)
      .minute(0)
      .second(0);
    if (dayBefore.isAfter(dayjs())) {
      await notifee.createTriggerNotification(
        {
          id: `food_tomorrow_${food.id}`,
          title: '🥡 Expire demain',
          body: `"${food.name}" doit être consommé !`,
          android: {
            channelId: CHANNELS.FOOD.id,
            smallIcon: 'ic_notification',
            color: '#FF8C00',
          },
          data: {
            type: 'FOOD_EXPIRY_TOMORROW',
            foodId: food.id,
            foodName: food.name,
            quantity: food.quantity ?? '',
            count: '1',
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: dayBefore.valueOf(),
        },
      );
    }

    // Rappel le jour J à 10h00
    const expiryDay = expiryDate.hour(10).minute(0).second(0);
    if (expiryDay.isAfter(dayjs())) {
      await notifee.createTriggerNotification(
        {
          id: `food_today_${food.id}`,
          title: "⚠️ Expire aujourd'hui !",
          body: `"${food.name}" — dernier jour !`,
          android: {
            channelId: CHANNELS.FOOD.id,
            smallIcon: 'ic_notification',
            color: '#FF4444',
            importance: AndroidImportance.HIGH,
          },
          data: {
            type: 'FOOD_EXPIRY_TODAY',
            foodId: food.id,
            foodName: food.name,
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: expiryDay.valueOf(),
        },
      );
    }
  }

  async cancelFoodReminders(foodId: string): Promise<void> {
    await notifee.cancelTriggerNotification(`food_tomorrow_${foodId}`);
    await notifee.cancelTriggerNotification(`food_today_${foodId}`);
  }

  async cancelEventReminders(eventId: string): Promise<void> {
    await notifee.cancelTriggerNotification(`event_24h_${eventId}`);
    await notifee.cancelTriggerNotification(`event_1h_${eventId}`);
    await notifee.cancelTriggerNotification(`event_birthday_${eventId}`);
  }

  // ── CHECK AU LANCEMENT ──────────────

  async checkExpiredFoodOnLaunch(): Promise<void> {
    const today = dayjs().format('YYYY-MM-DD');

    const { data: expiredItems } = await supabase
      .from('food_items')
      .select('*')
      .eq('household_id', this.householdId!)
      .lt('expiry_date', today)
      .is('consumed_at', null);

    if (!expiredItems || expiredItems.length === 0) return;

    const first = expiredItems[0] as Record<string, string>;
    await this.displayNotification({
      type: 'FOOD_ALREADY_EXPIRED',
      householdId: this.householdId!,
      data: {
        count: expiredItems.length,
        foodName: first.name,
        daysAgo: dayjs().diff(dayjs(first.expiry_date), 'day'),
      },
    });
  }

  // ── AFFICHAGE ───────────────────────

  async displayNotification(payload: NotificationPayload): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[payload.type];
    if (!template) return;

    const config = template(payload);

    await notifee.displayNotification({
      id: `${payload.type}_${Date.now()}`,
      title: config.title,
      body: config.body,
      android: {
        channelId: config.channel,
        smallIcon: 'ic_notification',
        largeIcon: 'ic_launcher',
        color: config.android?.color ?? '#F5A623',
        pressAction: { id: 'default' },
        style: config.android?.style as any,
        actions: config.android?.actions,
        importance:
          config.android?.importance ?? AndroidImportance.DEFAULT,
      },
      ios: {
        sound: 'default',
        badge: 1,
        ...config.ios,
      },
      data: {
        ...config.data,
        type: payload.type,
        householdId: payload.householdId,
      },
    });
  }

  // ── HELPERS ─────────────────────────

  private async getMemberName(userId: string): Promise<string> {
    const { data } = await supabase
      .from('household_members')
      .select('display_name')
      .eq('user_id', userId)
      .eq('household_id', this.householdId!)
      .single();
    return (data as { display_name: string } | null)?.display_name ?? "Quelqu'un";
  }
}

export const notificationService = NotificationService.getInstance();
