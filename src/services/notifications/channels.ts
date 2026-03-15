import notifee, { AndroidImportance } from '@notifee/react-native';

// ─── Définition des canaux Android ───────────────────────

export const CHANNELS = {
  TASKS: {
    id: 'majordhome_tasks',
    name: 'Tâches',
    description: 'Rappels et mises à jour des tâches du foyer',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    lights: true,
    lightColor: '#F5A623',
  },

  EVENTS: {
    id: 'majordhome_events',
    name: 'Événements',
    description: 'Rappels des événements du calendrier',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    lights: true,
    lightColor: '#4ECDC4',
  },

  FOOD: {
    id: 'majordhome_food',
    name: 'Aliments & DLC',
    description: 'Alertes dates de péremption',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
    vibration: true,
    lights: true,
    lightColor: '#34D399',
  },

  SHOPPING: {
    id: 'majordhome_shopping',
    name: 'Liste de courses',
    description: 'Mises à jour de la liste de courses',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
    vibration: false,
  },

  HOUSEHOLD: {
    id: 'majordhome_household',
    name: 'Foyer',
    description: 'Activité générale du foyer',
    importance: AndroidImportance.LOW,
    sound: 'default',
    vibration: false,
  },

  RECAP: {
    id: 'majordhome_recap',
    name: 'Récapitulatifs',
    description: 'Bilans quotidiens, hebdomadaires et mensuels',
    importance: AndroidImportance.LOW,
    sound: 'default',
    vibration: false,
  },
} as const;

export const createAllChannels = async (): Promise<void> => {
  await Promise.all(
    Object.values(CHANNELS).map(channel => notifee.createChannel(channel)),
  );
};
