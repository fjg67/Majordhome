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
  // CHAT
  // ══════════════════════════════════

  CHAT_NEW_MESSAGE: (p) => ({
    title: `💬 ${p.triggeredByName}`,
    body: `${p.data?.content}`,
    channel: CHANNELS.CHAT.id,
    android: {
      color: '#4ECDC4',
      importance: AndroidImportance.HIGH,
      actions: [
        { title: '💬 Ouvrir', pressAction: { id: 'open_chat' } },
      ],
    },
  }),

  CHAT_IMAGE: (p) => ({
    title: `📷 ${p.triggeredByName}`,
    body: p.data?.caption ? `${p.data.caption}` : 'A envoyé une photo',
    channel: CHANNELS.CHAT.id,
    android: {
      color: '#4ECDC4',
      importance: AndroidImportance.HIGH,
    },
  }),

  CHAT_AUDIO: (p) => ({
    title: `🎤 ${p.triggeredByName}`,
    body: `Message vocal · ${p.data?.duration ?? ''}s`,
    channel: CHANNELS.CHAT.id,
    android: {
      color: '#4ECDC4',
      importance: AndroidImportance.HIGH,
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

  // ══════════════════════════════════
  // BUDGET
  // ══════════════════════════════════

  BUDGET_EXPENSE_ADDED: (p) => ({
    title: `💸 ${p.triggeredByName} a ajouté une dépense`,
    body: `"${p.data?.expenseTitle}" — ${p.data?.amount}€ · Ta part : ${p.data?.share}€`,
    channel: CHANNELS.BUDGET.id,
    android: {
      color: '#F5A623',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `${p.triggeredByName} a enregistré une nouvelle dépense :\n\n📝 ${p.data?.expenseTitle}\n💰 Total : ${p.data?.amount}€\n👥 Ta part : ${p.data?.share}€\n🗂️ Catégorie : ${p.data?.category}`,
      },
      actions: [
        { title: '💰 Voir le budget', pressAction: { id: 'open_budget' } },
      ],
    },
  }),

  BUDGET_BALANCE_REMINDER: (p) => ({
    title: `⚖️ Tu dois ${p.data?.amount}€ au foyer`,
    body: p.data?.creditorName
      ? `${p.data.creditorName} t'a avancé de l'argent ce mois-ci`
      : 'Tu as un solde négatif dans le budget partagé',
    channel: CHANNELS.BUDGET.id,
    android: {
      color: '#FF8C00',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `Ton solde du mois :\n\n💸 Tu dois : ${p.data?.amount}€\n\nRègle ça avec tes colocataires pour équilibrer les comptes.`,
      },
      actions: [
        { title: '💰 Voir les soldes', pressAction: { id: 'open_budget' } },
      ],
      importance: AndroidImportance.DEFAULT,
    },
  }),

  BUDGET_SETTLED: (p) => ({
    title: '✅ Comptes soldés !',
    body: `${p.data?.memberName ?? 'Le foyer'} a réglé ses dettes — tout est à zéro 🎉`,
    channel: CHANNELS.BUDGET.id,
    android: {
      color: '#34D399',
      importance: AndroidImportance.DEFAULT,
    },
  }),

  // ══════════════════════════════════
  // NOTES
  // ══════════════════════════════════

  // ══════════════════════════════════
  // CORVÉES
  // ══════════════════════════════════

  CHORE_REMINDER: (p) => ({
    title: `🔄 Corvée du jour : ${p.data?.choreTitle}`,
    body: `C'est ton tour ! ~${p.data?.durationMin} min estimées`,
    channel: CHANNELS.TASKS.id,
    android: {
      color: (p.data?.catColor as string) || '#F5A623',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `C'est ton tour pour la corvée :\n\n"${p.data?.choreTitle}"\n⏱ Durée estimée : ~${p.data?.durationMin} min`,
      },
      actions: [
        { title: '✓ Fait !',     pressAction: { id: 'mark_chore_done' } },
        { title: '⏭️ Passer',    pressAction: { id: 'skip_chore' } },
      ],
    },
  }),

  CHORE_OVERDUE: (p) => ({
    title: '⚠️ Corvée en retard',
    body: `"${p.data?.choreTitle}" n'a pas été faite`,
    channel: CHANNELS.TASKS.id,
    android: {
      color: '#FF4444',
      importance: AndroidImportance.HIGH,
      actions: [
        { title: '✓ Faire maintenant', pressAction: { id: 'mark_chore_done' } },
      ],
    },
  }),

  CHORE_NEXT_TURN: (p) => ({
    title: '🔄 À ton tour !',
    body: `${p.triggeredByName} a fait "${p.data?.choreTitle}" · C'est maintenant ton tour`,
    channel: CHANNELS.TASKS.id,
    android: {
      color: (p.data?.catColor as string) || '#F5A623',
      actions: [
        { title: '✓ Je m\'en occupe', pressAction: { id: 'mark_chore_done' } },
      ],
    },
  }),

  // ══════════════════════════════════
  // SONDAGES
  // ══════════════════════════════════

  POLL_CREATED: (p) => ({
    title: `🗳️ ${p.triggeredByName ?? 'Quelqu\'un'} a créé un sondage`,
    body: `"${p.data?.question ?? ''}"`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#F5A623',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `${p.triggeredByName} veut votre avis :\n\n"${p.data?.question}"\n\nOptions : ${p.data?.optionsPreview ?? ''}`,
      },
      actions: [
        { title: '🗳️ Voter', pressAction: { id: 'open_poll' } },
      ],
    },
  }),

  POLL_VOTE: (p) => ({
    title: `✓ ${p.triggeredByName ?? 'Quelqu\'un'} a voté`,
    body: `"${p.data?.question ?? ''}" · ${p.data?.votedCount ?? '?'}/${p.data?.totalMembers ?? '?'} ont voté`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: { color: '#34D399' },
  }),

  POLL_COMPLETE: (_p) => ({
    title: `🎉 Tout le monde a voté !`,
    body: `"${_p.data?.question ?? ''}" · Résultat : "${_p.data?.winnerOption ?? ''}"`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: { color: '#FFD700', importance: AndroidImportance.HIGH },
  }),

  POLL_EXPIRING: (p) => ({
    title: `⏰ Sondage expire bientôt`,
    body: `"${p.data?.question ?? ''}" — il reste ${p.data?.timeLeft ?? '?'} pour voter`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#FF8C00',
      actions: [
        { title: '🗳️ Voter vite !', pressAction: { id: 'open_poll' } },
      ],
    },
  }),

  // ══════════════════════════════════
  // HUMEURS
  // ══════════════════════════════════

  MOOD_REMINDER: (_p) => ({
    title: `😊 Comment s'est passée ta journée ?`,
    body: `N'oublie pas de renseigner ton humeur du jour !`,
    channel: CHANNELS.RECAP.id,
    android: {
      color: '#F5A623',
      actions: [
        { title: '😄 Super',  pressAction: { id: 'mood_super'  } },
        { title: '😊 Bien',   pressAction: { id: 'mood_bien'   } },
        { title: '😐 Neutre', pressAction: { id: 'mood_neutre' } },
      ],
    },
  }),

  MOOD_SUPPORT: (p) => ({
    title: `💙 ${p.triggeredByName ?? 'Quelqu\'un'} n'est pas au top`,
    body: `${p.triggeredByName ?? 'Un membre'} se sent ${p.data?.moodLabel ?? 'pas bien'} aujourd'hui — un petit message ?`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#A78BFA',
      actions: [
        { title: '💬 Lui écrire', pressAction: { id: 'open_chat' } },
      ],
    },
  }),

  // ══════════════════════════════════
  // RÉCOMPENSES
  // ══════════════════════════════════

  LEVEL_UP: (p) => ({
    title: `🎉 Tu as atteint un nouveau niveau !`,
    body: `Tu es maintenant ${p.data?.label} (Niv. ${p.data?.level}) — continue !`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: p.data?.color ?? '#FFD700',
      importance: AndroidImportance.HIGH,
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `Félicitations ! Tu es passé au niveau ${p.data?.level} : ${p.data?.label} ${p.data?.emoji}`,
      },
      actions: [
        { title: '🏆 Voir', pressAction: { id: 'open_rewards' } },
      ],
    },
  }),

  BADGE_UNLOCK: (p) => ({
    title: `🎖️ Badge débloqué : ${p.data?.name}`,
    body: `${p.data?.emoji} "${p.data?.name}" +${p.data?.xpReward} XP`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: p.data?.rarityColor ?? '#F5A623',
      actions: [
        { title: '🏆 Voir', pressAction: { id: 'open_rewards' } },
      ],
    },
  }),

  // ══════════════════════════════════
  // MINUTEURS
  // ══════════════════════════════════

  TIMER_FINISHED: (p) => ({
    title: '⏰ Minuteur terminé !',
    body: `"${p.data?.title}" est terminé`,
    channel: CHANNELS.TASKS.id,
    android: {
      color: '#FF4444',
      importance: AndroidImportance.HIGH,
      actions: [
        { title: '↩ Relancer', pressAction: { id: 'restart_timer' } },
        { title: '✓ OK',       pressAction: { id: 'dismiss'        } },
      ],
    },
  }),

  TIMER_STARTED: (p) => ({
    title: `▶ ${p.triggeredByName} a démarré un minuteur`,
    body: `"${p.data?.title}" · ${p.data?.duration}`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: { color: '#34D399' },
  }),

  // ══════════════════════════════════
  // DOCUMENTS
  // ══════════════════════════════════

  DOC_UPLOADED: (p) => ({
    title: `📁 ${p.triggeredByName} a ajouté un document`,
    body: `"${p.data?.title}" · ${p.data?.category} · ${p.data?.size}`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#F5A623',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `${p.triggeredByName} a partagé un nouveau document :\n\n"${p.data?.title}"\n📂 ${p.data?.category} · ${p.data?.size}`,
      },
      actions: [
        { title: '👀 Voir', pressAction: { id: 'open_documents' } },
      ],
    },
  }),

  DOC_EXPIRY_30D: (p) => ({
    title: '📋 Document expire dans 30 jours',
    body: `"${p.data?.title}" expire le ${p.data?.expiryDate}`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#FF8C00',
      actions: [
        { title: '👀 Voir', pressAction: { id: 'open_document' } },
      ],
    },
  }),

  DOC_EXPIRY_7D: (p) => ({
    title: '⚠️ Document expire dans 7 jours',
    body: `"${p.data?.title}" — pensez à le renouveler`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#FF8C00',
      importance: AndroidImportance.HIGH,
      actions: [
        { title: '👀 Voir', pressAction: { id: 'open_document' } },
      ],
    },
  }),

  DOC_EXPIRED: (p) => ({
    title: '❌ Document expiré',
    body: `"${p.data?.title}" est arrivé à expiration`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#FF4444',
      importance: AndroidImportance.HIGH,
    },
  }),

  NOTE_CREATED: (p) => ({
    title: `📝 ${p.triggeredByName} a créé une note`,
    body: `"${p.data?.title}"${p.data?.category && p.data.category !== 'memo' ? ` · ${p.data?.category}` : ''}`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: (p.data?.catColor as string) || '#F5A623',
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `${p.triggeredByName} a ajouté une nouvelle note partagée :\n\n"${p.data?.title}"`,
      },
      actions: [
        { title: '👀 Voir', pressAction: { id: 'open_notes' } },
      ],
    },
  }),

  NOTE_EDITED: (p) => ({
    title: `✏️ ${p.triggeredByName} a modifié une note`,
    body: `"${p.data?.title}"`,
    channel: CHANNELS.HOUSEHOLD.id,
    android: {
      color: '#F5A623',
      actions: [
        { title: '👀 Voir', pressAction: { id: 'open_notes' } },
      ],
    },
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
