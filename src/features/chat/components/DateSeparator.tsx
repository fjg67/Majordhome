import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import 'dayjs/locale/fr';
import { CHAT_COLORS as C } from '../types/chat.types';

dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.locale('fr');

interface DateSeparatorProps {
  date: Date;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  const d = dayjs(date);
  let label: string;

  if (d.isToday()) {
    label = "Aujourd'hui";
  } else if (d.isYesterday()) {
    label = 'Hier';
  } else {
    label = d.format('dddd D MMMM');
  }

  return (
    <View style={styles.separator}>
      <View style={styles.separatorLine} />
      <View style={styles.separatorBadge}>
        <Text style={styles.separatorText}>{label}</Text>
      </View>
      <View style={styles.separatorLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  separatorBadge: {
    backgroundColor: 'rgba(38,20,0,0.90)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.amberBorder,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginHorizontal: 8,
  },
  separatorText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
    textTransform: 'capitalize',
  },
});
