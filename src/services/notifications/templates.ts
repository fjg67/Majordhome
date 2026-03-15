import { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { CHANNELS } from './channels';
import type { NotificationType, NotificationPayload, NotificationConfig } from './types';

// ─── Templates de contenu par type de notification ───────

export const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  (payload: NotificationPayload) => NotificationConfig
> = {
  // ══════════════════════════════════
  // TÂCHES
  // ══════════════════════════════════

  TASK_ASSIGNED: (p) => ({
    title: '📋 Nouvelle tâche pour toi',
    body: `${p.triggeredByName} t'a assigné : "${p.data?.taskTitle}"`,
    channel: CHANNELS.TASKS.id,
    android: {
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `${p.triggeredByName} t'a assigné une nouvelle tâche :\n\n"${p.data?.taskTitle}"\n\nÉchéance : ${p.data?.dueDate}`,
      },
      actions: [
        { title: '✓ Accepter', pressAction: { id: 'accept_task' } },
        { title: '👀 Voir', pressAction: { id: 'view_task' } },
      ],
      color: '#F5A623',
    },
  }),

  TASK_COMPLETED_PARTNER: (p) => ({
    title: '✅ Tâche complétée !',
    body: `${p.triggeredByName} a fait : "${p.data?.taskTitle}" 🎉`,
    channel: CHANNELS.TASKS.id,
    android: {
      color: '#34D399',
      actions: [
        { title: '👏 Super !', pressAction: { id: 'react_task_done' } },
      ],
    },
  }),

  TASK_REMINDER_MORNING: (p) => ({
    title: `🌅 Bonjour ! ${p.data?.taskCount} tâche(s) aujourd'hui`,
    body:
      Number(p.data?.taskCount) === 1
        ? `À faire : "${p.data?.firstTaskTitle}"`
        : `Dont : "${p.data?.firstTaskTitle}" et ${Number(p.data?.taskCount) - 1} autre(s)`,
    channel: CHANNELS.TASKS.id,
    android: {
      style: {
        type: AndroidStyle.INBOX,
        lines: (p.data?.taskTitles as string[] | undefined) ?? [],
        title: `${p.data?.taskCount} tâches pour aujourd'hui`,
        summary: 'MajordHome',
      },
      color: '#F5A623',
      actions: [
        { title: '📋 Voir les tâches', pressAction: { id: 'open_tasks' } },
      ],
    },
  }),

  TASK_REMINDER_EVENING: (p) => ({
    title: `🌙 ${p.data?.remainingCount} tâche(s) non terminée(s)`,
    body: `Il reste encore "${p.data?.firstTaskTitle}"${
      Number(p.data?.remainingCount) > 1
        ? ` et ${Number(p.data?.remainingCount) - 1} autre(s)`
        : ''
    }`,
    channel: CHANNELS.TASKS.id,
    android: {
      color: '#FF8C00',
      actions: [
        { title: '✓ Marquer faites', pressAction: { id: 'open_tasks' } },
        { title: '📅 Reporter', pressAction: { id: 'postpone_tasks' } },
      ],
    },
  }),

  TASK_OVERDUE: (p) => ({
    title: '⚠️ Tâche en retard',
    body: `"${p.data?.taskTitle}" était prévue le ${p.data?.dueDate}`,
    channel: CHANNELS.TASKS.id,
    android: {
      color: '#FF4444',
      actions: [
        { title: '✓ Faire maintenant', pressAction: { id: 'open_task' } },
        { title: '🗑️ Supprimer', pressAction: { id: 'delete_task' } },
      ],
    },
  }),

  TASK_STREAK: (p) => ({
    title: `🔥 Streak de ${p.data?.streakDays} jours !`,
    body: `Bravo ${p.data?.memberName} ! Tu es au top ce mois-ci 💪`,
    channel: CHANNELS.TASKS.id,
    android: { color: '#FF8C00' },
  }),

  // ══════════════════════════════════
  // ÉVÉNEMENTS
  // ══════════════════════════════════

  EVENT_CREATED: (p) => ({
    title: '📅 Nouvel événement',
    body: `${p.triggeredByName} a ajouté : "${p.data?.eventTitle}" le ${p.data?.eventDate}`,
    channel: CHANNELS.EVENTS.id,
    android: {
      color: '#4ECDC4',
      actions: [
        { title: '👀 Voir', pressAction: { id: 'view_event' } },
      ],
    },
  }),

  EVENT_REMINDER_24H: (p) => ({
    title: '📅 Rappel — demain',
    body: `"${p.data?.eventTitle}" à ${p.data?.eventTime} · ${p.data?.eventLocation || 'Lieu non précisé'}`,
    channel: CHANNELS.EVENTS.id,
    android: {
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `Événement demain :\n\n📌 ${p.data?.eventTitle}\n🕐 ${p.data?.eventTime}\n📍 ${p.data?.eventLocation || 'Lieu non précisé'}\n👥 ${p.data?.participants || 'Foyer'}`,
      },
      color: '#4ECDC4',
      actions: [
        { title: '📍 Itinéraire', pressAction: { id: 'open_maps' } },
        { title: '👀 Détails', pressAction: { id: 'view_event' } },
      ],
    },
  }),

  EVENT_REMINDER_1H: (p) => ({
    title: '⏰ Dans 1 heure !',
    body: `"${p.data?.eventTitle}" commence à ${p.data?.eventTime}`,
    channel: CHANNELS.EVENTS.id,
    android: {
      color: '#FF8C00',
      importance: AndroidImportance.HIGH,
      actions: [
        { title: '📍 Itinéraire', pressAction: { id: 'open_maps' } },
      ],
    },
  }),

  EVENT_TODAY: (p) => ({
    title: '☀️ Programme du jour',
    body:
      Number(p.data?.eventCount) === 0
        ? "Aucun événement aujourd'hui — journée libre !"
        : `${p.data?.eventCount} événement(s) · Prochain : "${p.data?.firstEventTitle}" à ${p.data?.firstEventTime}`,
    channel: CHANNELS.RECAP.id,
    android: {
      color: '#F5A623',
      style:
        Number(p.data?.eventCount) > 1
          ? {
              type: AndroidStyle.INBOX,
              lines: (p.data?.eventLines as string[] | undefined) ?? [],
              title: `${p.data?.eventCount} événements aujourd'hui`,
              summary: 'MajordHome',
            }
          : undefined,
    },
  }),

  EVENT_BIRTHDAY_TODAY: (p) => ({
    title: "🎂 Anniversaire aujourd'hui !",
    body: `N'oublie pas : "${p.data?.eventTitle}" — pense à les appeler !`,
    channel: CHANNELS.EVENTS.id,
    android: {
      color: '#FF6B6B',
      importance: AndroidImportance.HIGH,
    },
  }),

  // ══════════════════════════════════
  // ALIMENTS / DLC
  // ══════════════════════════════════

  FOOD_EXPIRY_TOMORROW: (p) => ({
    title: '🥡 Expire demain',
    body:
      Number(p.data?.count) === 1
        ? `"${p.data?.foodName}" (${p.data?.quantity}) — à consommer vite !`
        : `${p.data?.count} aliments expirent demain — dont "${p.data?.foodName}"`,
    channel: CHANNELS.FOOD.id,
    android: {
      color: '#FF8C00',
      style:
        Number(p.data?.count) > 1
          ? {
              type: AndroidStyle.INBOX,
              lines: (p.data?.foodLines as string[] | undefined) ?? [],
              title: `${p.data?.count} aliments expirent demain`,
              summary: 'MajordHome · Aliments',
            }
          : undefined,
      actions: [
        { title: '🛒 Ajouter aux courses', pressAction: { id: 'add_to_shopping' } },
        { title: '👀 Voir', pressAction: { id: 'open_food' } },
      ],
    },
  }),

  FOOD_EXPIRY_TODAY: (p) => ({
    title: "⚠️ Expire aujourd'hui !",
    body: `"${p.data?.foodName}" doit être consommé aujourd'hui`,
    channel: CHANNELS.FOOD.id,
    android: {
      color: '#FF4444',
      importance: AndroidImportance.HIGH,
      actions: [
        { title: '✓ Consommé', pressAction: { id: 'mark_consumed' } },
        { title: '🗑️ Jeter', pressAction: { id: 'mark_wasted' } },
      ],
    },
  }),

  FOOD_ALREADY_EXPIRED: (p) => ({
    title: `❌ ${p.data?.count} aliment(s) expiré(s)`,
    body:
      Number(p.data?.count) === 1
        ? `"${p.data?.foodName}" est périmé depuis ${p.data?.daysAgo} jour(s)`
        : `Dont "${p.data?.foodName}" — vérifie ton frigo !`,
    channel: CHANNELS.FOOD.id,
    android: {
      color: '#FF4444',
      actions: [
        { title: '🗑️ Nettoyer', pressAction: { id: 'open_food' } },
      ],
    },
  }),

  FOOD_ADDED_PARTNER: (p) => ({
    title: `🥦 ${p.triggeredByName} a ajouté des aliments`,
    body: `"${p.data?.foodName}"${
      Number(p.data?.count) > 1
        ? ` + ${Number(p.data?.count) - 1} autre(s)`
        : ''
    } — DLC : ${p.data?.expiryDate}`,
    channel: CHANNELS.FOOD.id,
    android: { color: '#34D399' },
  }),

  FOOD_WEEKLY_WASTE_REPORT: (p) => ({
    title: '♻️ Bilan de la semaine',
    body:
      Number(p.data?.wastedCount) === 0
        ? 'Zéro gaspillage cette semaine ! 🏆 Excellent !'
        : `${p.data?.wastedCount} aliment(s) gaspillé(s) · ${p.data?.consumedCount} consommé(s)`,
    channel: CHANNELS.RECAP.id,
    android: {
      color: Number(p.data?.wastedCount) === 0 ? '#34D399' : '#FF8C00',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `Bilan alimentaire de la semaine :\n\n✅ Consommés : ${p.data?.consumedCount}\n❌ Gaspillés : ${p.data?.wastedCount}\n💰 Économies estimées : ${p.data?.savedAmount}€\n\n${p.data?.tip ?? ''}`,
      },
    },
  }),

  // ══════════════════════════════════
  // COURSES
  // ══════════════════════════════════

  SHOPPING_ITEM_ADDED: (p) => ({
    title: `🛒 ${p.triggeredByName} a ajouté à la liste`,
    body:
      Number(p.data?.count) === 1
        ? `"${p.data?.itemName}" ajouté aux courses`
        : `${p.data?.count} articles ajoutés — dont "${p.data?.itemName}"`,
    channel: CHANNELS.SHOPPING.id,
    android: { color: '#F5A623' },
  }),

  SHOPPING_ITEM_CHECKED: (p) => ({
    title: `✓ ${p.triggeredByName} fait les courses`,
    body: `"${p.data?.itemName}" coché · ${p.data?.remainingCount} article(s) restant(s)`,
    channel: CHANNELS.SHOPPING.id,
    android: { color: '#34D399' },
  }),

  SHOPPING_LIST_COMPLETE: (p) => ({
    title: '🎉 Liste de courses complète !',
    body: `${p.triggeredByName} a tout coché — ${p.data?.totalCount} articles achetés`,
    channel: CHANNELS.SHOPPING.id,
    android: {
      color: '#34D399',
      importance: AndroidImportance.HIGH,
    },
  }),

  SHOPPING_DLC_SUGGESTION: (p) => ({
    title: '💡 Suggestion : refaire les courses ?',
    body: `${p.data?.foodName} expire dans ${p.data?.daysLeft} jour(s) — l'ajouter à la liste ?`,
    channel: CHANNELS.SHOPPING.id,
    android: {
      color: '#F5A623',
      actions: [
        { title: '+ Ajouter', pressAction: { id: 'add_suggested_item' } },
        { title: 'Ignorer', pressAction: { id: 'dismiss' } },
      ],
    },
  }),

  // ══════════════════════════════════
  // FOYER
  // ══════════════════════════════════

  MEMBER_JOINED: (p) => ({
    title: '👋 Nouveau membre !',
    body: `${p.data?.memberName} a rejoint "${p.data?.householdName}" 🏠`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: { color: '#A78BFA' },
  }),

  MEMBER_LEFT: (p) => ({
    title: `👋 ${p.data?.memberName} a quitté le foyer`,
    body: `Le foyer compte maintenant ${p.data?.remainingCount} membre(s)`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: { color: '#FF6B6B' },
  }),

  HOUSEHOLD_WEEKLY_RECAP: (p) => ({
    title: `📊 Bilan de la semaine — ${p.data?.householdName}`,
    body: `${p.data?.completedTasks} tâches faites · ${p.data?.topMemberName} est le MVP 🏆`,
    channel: CHANNELS.RECAP.id,
    android: {
      color: '#F5A623',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: [
          `Bilan de la semaine pour "${p.data?.householdName}" :`,
          '',
          `✅ Tâches complétées : ${p.data?.completedTasks}`,
          `📅 Événements passés : ${p.data?.eventCount}`,
          `🥑 Aliments consommés : ${p.data?.consumedFood}`,
          `♻️ Gaspillage : ${p.data?.wastedFood}`,
          '',
          `🏆 MVP : ${p.data?.topMemberName} (${p.data?.topMemberTasks} tâches)`,
        ].join('\n'),
      },
    },
  }),

  HOUSEHOLD_MONTHLY_STATS: (p) => ({
    title: `🎯 Bilan du mois de ${p.data?.monthName}`,
    body: `${p.data?.totalTasks} tâches · ${p.data?.completionRate}% de complétion · ${p.data?.wastedFood} gaspillés`,
    channel: CHANNELS.RECAP.id,
    android: { color: '#F5A623' },
  }),

  APP_UPDATE_AVAILABLE: (p) => ({
    title: '🚀 Mise à jour disponible',
    body: `MajordHome v${p.data?.version} est disponible — nouveautés : ${p.data?.changelog}`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#4ECDC4',
      actions: [
        { title: '⬇️ Mettre à jour', pressAction: { id: 'open_store' } },
        { title: 'Plus tard', pressAction: { id: 'dismiss' } },
      ],
    },
  }),
};
