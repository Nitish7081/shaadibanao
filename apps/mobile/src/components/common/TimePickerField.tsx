import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius } from '../../constants/theme';
import {
  formatApiTime,
  parseApiTime,
  formatDisplayTime,
} from '../../utils/dateTimeHelpers';

export interface TimePickerFieldProps {
  label?: string;
  value: string; // HH:mm (24-hour format)
  onChange: (timeStr: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  testID?: string;
}

export const TimePickerField: React.FC<TimePickerFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  testID,
}) => {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const [showPicker, setShowPicker] = useState(false);
  const [iosTempTime, setIosTempTime] = useState<Date>(new Date());

  const parsedValue = parseApiTime(value);
  const activeTime = parsedValue || new Date();

  const handleOpenPicker = () => {
    if (disabled) return;
    setIosTempTime(activeTime);
    setShowPicker(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && selectedTime) {
      onChange(formatApiTime(selectedTime));
    }
  };

  const handleIosTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
    if (selectedTime) {
      setIosTempTime(selectedTime);
    }
  };

  const handleIosDone = () => {
    setShowPicker(false);
    onChange(formatApiTime(iosTempTime));
  };

  const handleIosCancel = () => {
    setShowPicker(false);
  };

  const displayString = value ? formatDisplayTime(value, isHindi ? 'hi' : 'en') : '';
  const defaultPlaceholder = isHindi ? 'समय चुनें' : 'Select Time';

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.fieldBox,
          error ? styles.fieldBoxError : null,
          disabled ? styles.fieldBoxDisabled : null,
        ]}
        onPress={handleOpenPicker}
        activeOpacity={0.75}
        disabled={disabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label || 'Select Time'}
      >
        <Text
          style={[
            styles.fieldText,
            !displayString ? styles.placeholderText : null,
            disabled ? styles.textDisabled : null,
          ]}
          numberOfLines={1}
        >
          {displayString || placeholder || defaultPlaceholder}
        </Text>
        <Ionicons
          name="time-outline"
          size={20}
          color={disabled ? colors.textMuted : colors.royalMaroon}
          style={styles.icon}
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {/* Android Native Dialog */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={activeTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleAndroidChange}
        />
      )}

      {/* iOS Modal Sheet */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={handleIosCancel}
        >
          <View style={styles.iosModalOverlay}>
            <TouchableOpacity
              style={styles.iosModalBackdrop}
              activeOpacity={1}
              onPress={handleIosCancel}
            />
            <View style={styles.iosModalContent}>
              <View style={styles.iosModalHeader}>
                <TouchableOpacity onPress={handleIosCancel} style={styles.iosModalBtn}>
                  <Text style={styles.iosCancelText}>{isHindi ? 'रद्द करें' : 'Cancel'}</Text>
                </TouchableOpacity>
                <Text style={styles.iosModalTitle}>
                  {label ? label.replace('*', '').trim() : (isHindi ? 'समय चुनें' : 'Select Time')}
                </Text>
                <TouchableOpacity onPress={handleIosDone} style={styles.iosModalBtn}>
                  <Text style={styles.iosDoneText}>{isHindi ? 'पूर्ण' : 'Done'}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosTempTime}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={handleIosTimeChange}
                textColor={colors.charcoal || '#2D1B22'}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary || '#6B5E62',
    marginBottom: 6,
  },
  required: {
    color: colors.alertRed || '#C92A2A',
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight || '#E8E2D8',
    borderRadius: borderRadius.md,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  fieldBoxError: {
    borderColor: colors.alertRed || '#C92A2A',
  },
  fieldBoxDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  fieldText: {
    fontSize: 15,
    color: colors.charcoal || '#2D1B22',
    fontWeight: '500',
    flex: 1,
  },
  placeholderText: {
    color: colors.textMuted || '#9B8E92',
    fontWeight: '400',
  },
  textDisabled: {
    color: colors.textMuted || '#9B8E92',
  },
  icon: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.alertRed || '#C92A2A',
    marginTop: 4,
    marginLeft: 2,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted || '#9B8E92',
    marginTop: 4,
    marginLeft: 2,
  },
  iosModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  iosModalBackdrop: {
    flex: 1,
  },
  iosModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  iosModalBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  iosCancelText: {
    color: colors.textSecondary || '#6B5E62',
    fontSize: 15,
  },
  iosDoneText: {
    color: colors.royalMaroon || '#7A1528',
    fontSize: 15,
    fontWeight: '700',
  },
  iosModalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.charcoal || '#2D1B22',
  },
  iosPicker: {
    height: 215,
    backgroundColor: '#FFFFFF',
  },
});
