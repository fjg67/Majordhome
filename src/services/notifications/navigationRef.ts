import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '@app/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
