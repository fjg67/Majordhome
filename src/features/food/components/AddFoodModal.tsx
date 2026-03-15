import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '@shared/hooks/useTheme';
import { GlassCard } from '@shared/components/GlassCard';
import { CATEGORY_EMOJIS } from '@shared/theme/colors';
import type { FoodCategory } from '@appTypes/index';

interface AddFoodModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (food: {
    name: string;
    quantity: string;
    unit: string;
    category: FoodCategory;
    expiry_date: string;
  }) => void;
}

const FOOD_CATEGORIES: { key: FoodCategory; label: string }[] = [
  { key: 'dairy', label: '🥛 Laitages' },
  { key: 'meat', label: '🥩 Viande' },
  { key: 'vegetables', label: '🥦 Légumes' },
  { key: 'fruits', label: '🍎 Fruits' },
  { key: 'frozen', label: '🧊 Surgelés' },
  { key: 'other', label: '📦 Autre' },
];

export const AddFoodModal: React.FC<AddFoodModalProps> = ({
  visible,
  onClose,
  onAdd,
}) => {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<FoodCategory>('other');
  const [expiryDate, setExpiryDate] = useState('');

  const resetForm = useCallback(() => {
    setName('');
    setQuantity('');
    setUnit('');
    setCategory('other');
    setExpiryDate('');
  }, []);

  const handleAdd = useCallback(() => {
    if (!name.trim() || !expiryDate.trim()) return;
    onAdd({
      name: name.trim(),
      quantity: quantity.trim(),
      unit: unit.trim(),
      category,
      expiry_date: expiryDate,
    });
    resetForm();
    onClose();
  }, [name, quantity, unit, category, expiryDate, onAdd, onClose, resetForm]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      borderColor: theme.colors.inputBorder,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <GlassCard
          style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          entering="none"
        >
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
            Ajouter un aliment
          </Text>

          <TextInput
            style={inputStyle}
            placeholder="Nom de l'aliment"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            accessibilityLabel="Nom de l'aliment"
            autoFocus
          />

          <View style={styles.row}>
            <TextInput
              style={[...inputStyle, styles.halfInput]}
              placeholder="Quantité"
              placeholderTextColor={theme.colors.textMuted}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              accessibilityLabel="Quantité"
            />
            <TextInput
              style={[...inputStyle, styles.halfInput]}
              placeholder="Unité (g, ml, pcs)"
              placeholderTextColor={theme.colors.textMuted}
              value={unit}
              onChangeText={setUnit}
              accessibilityLabel="Unité"
            />
          </View>

          {/* Catégorie */}
          <Text
            style={[
              theme.typography.label,
              { color: theme.colors.textSecondary },
            ]}
          >
            Catégorie
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {FOOD_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor:
                      category === cat.key
                        ? theme.colors.primaryLight
                        : theme.colors.cardBg,
                    borderColor:
                      category === cat.key
                        ? theme.colors.primary
                        : theme.colors.cardBorder,
                  },
                ]}
                accessibilityLabel={`Catégorie ${cat.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: category === cat.key }}
              >
                <Text style={theme.typography.caption}>{cat.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Date DLC */}
          <TextInput
            style={inputStyle}
            placeholder="Date d'expiration (AAAA-MM-JJ)"
            placeholderTextColor={theme.colors.textMuted}
            value={expiryDate}
            onChangeText={setExpiryDate}
            accessibilityLabel="Date d'expiration"
          />

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              style={[
                styles.btn,
                { backgroundColor: theme.colors.cardBg },
              ]}
              accessibilityLabel="Annuler"
            >
              <Text
                style={[
                  theme.typography.button,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Annuler
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              style={[
                styles.btn,
                { backgroundColor: theme.colors.primary },
              ]}
              accessibilityLabel="Ajouter"
            >
              <Text style={[theme.typography.button, { color: '#FFFFFF' }]}>
                Ajouter
              </Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 24,
    gap: 14,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  categories: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
