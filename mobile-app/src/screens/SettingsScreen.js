import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from '../components/ui';
import AppText from '../components/AppText';
import { hydrateSettings, resetSettings, updateSetting } from '../store/settingsSlice';
import { useMobileTranslation } from '../utils/translations';

const Text = AppText;

const notificationOptions = [
  { key: 'showGeneralBanners', icon: 'notifications', title: 'General updates', description: 'Announcements and other campus notices' },
  { key: 'showIncidentBanners', icon: 'report', title: 'Incident notices', description: 'In-app banners about reported incidents' },
  { key: 'showEmergencyBanners', icon: 'emergency', title: 'Emergency & SOS notices', description: 'In-app banners for emergency-related updates' },
];

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const { preferences, hydrated } = useSelector((state) => state.settings);
  const [saving, setSaving] = useState(false);
  const t = useMobileTranslation();
  const deviceColorScheme = useColorScheme();
  const isDark = preferences.theme === 'dark'
    || (preferences.theme === 'system' && deviceColorScheme === 'dark');

  useEffect(() => {
    if (!hydrated) dispatch(hydrateSettings());
  }, [dispatch, hydrated]);

  const savePreference = async (key, value) => {
    setSaving(true);
    try {
      await dispatch(updateSetting({ key, value })).unwrap();
    } catch (error) {
      Alert.alert(t('Could not save setting'), t('Please try again. Your previous preference is unchanged.'));
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = () => Alert.alert(
    t('Reset settings?'),
    t('All settings will return to their default values.'),
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          setSaving(true);
          try {
            await dispatch(resetSettings()).unwrap();
          } catch (error) {
            Alert.alert(t('Could not reset settings'), t('Please try again.'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F5F8F7' }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Icon name="settings" size={24} color="#116B5F" /></View>
        <Text style={[styles.title, { color: isDark ? '#F1F5F9' : '#24343A' }]}>{t('Settings')}</Text>
        <Text style={styles.subtitle}>{t('Make Campus Security work the way you need it.')}</Text>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F1F5F9' : '#24343A' }]}>{t('Notification preferences')}</Text>
        <Text style={styles.sectionCaption}>{t('Choose which optional in-app banners appear.')}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        {notificationOptions.map((option, index) => (
          <View key={option.key} style={[styles.preferenceRow, index < notificationOptions.length - 1 && styles.rowDivider]}>
            <View style={styles.optionIcon}><Icon name={option.icon} size={20} color={option.key === 'showEmergencyBanners' ? '#C34B40' : '#116B5F'} /></View>
            <View style={styles.optionCopy}>
              <Text style={[styles.optionTitle, { color: isDark ? '#F1F5F9' : '#293B40' }]}>{t(option.title)}</Text>
              <Text style={styles.optionDescription}>{t(option.description)}</Text>
            </View>
            <Switch
              accessibilityLabel={t(option.title)}
              accessibilityRole="switch"
              accessibilityState={{ checked: preferences[option.key], disabled: saving || !hydrated }}
              value={preferences[option.key]}
              onValueChange={(value) => savePreference(option.key, value)}
              disabled={saving || !hydrated}
              trackColor={{ false: '#D7E0DE', true: '#A8D8C9' }}
              thumbColor={preferences[option.key] ? '#116B5F' : '#FFFFFF'}
            />
          </View>
        ))}
      </View>

      <View style={styles.noteCard}>
        <Icon name="info" size={19} color="#2D6CDF" />
        <Text style={styles.noteText}>
          {t('These controls affect in-app banners only. They do not change emergency response, SOS delivery, incident reporting, or the Alerts inbox.')}
        </Text>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F1F5F9' : '#24343A' }]}>{t('Sound & vibration')}</Text>
        <Text style={styles.sectionCaption}>{t('Vibrate for in-app alerts')}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.preferenceRow}>
          <View style={styles.optionIcon}><Icon name="notifications" size={20} color="#116B5F" /></View>
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: isDark ? '#F1F5F9' : '#293B40' }]}>{t('Vibrate for in-app alerts')}</Text>
            <Text style={styles.optionDescription}>{t('This build has no native Android notification sound channel. In-app banners are silent; Android settings only control system-delivered notifications.')}</Text>
          </View>
          <Switch value={preferences.vibrateOnAlerts} onValueChange={(value) => savePreference('vibrateOnAlerts', value)} disabled={saving || !hydrated} accessibilityRole="switch" accessibilityLabel={t('Vibrate for in-app alerts')} />
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F1F5F9' : '#24343A' }]}>{t('Privacy & safety')}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        {[
          ['shareLocation', 'Share location by default', 'Disables automatic location sharing for incident reports and officer updates. SOS still includes location for emergency response.'],
          ['confirmSOS', 'Confirm before sending SOS', 'Show a confirmation before submitting a critical emergency report.'],
          ['dataSaving', 'Data saving', 'Reduce nonessential officer location refreshes while keeping SOS and emergency delivery unchanged.'],
        ].map(([key, label, description], index, options) => (
          <View key={key} style={[styles.preferenceRow, index < options.length - 1 && styles.rowDivider]}>
            <View style={styles.optionCopy}>
              <Text style={[styles.optionTitle, { color: isDark ? '#F1F5F9' : '#293B40' }]}>{t(label)}</Text>
              <Text style={styles.optionDescription}>{t(description)}</Text>
            </View>
            <Switch
              accessibilityLabel={t(label)}
              accessibilityRole="switch"
              value={preferences[key]}
              onValueChange={(value) => savePreference(key, value)}
              disabled={saving || !hydrated}
            />
          </View>
        ))}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F1F5F9' : '#24343A' }]}>{t('Theme')}</Text>
      </View>
      <View style={styles.choiceRow}>
        {['system', 'light', 'dark'].map((value) => (
          <TouchableOpacity
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: preferences.theme === value }}
            style={[styles.choiceButton, { backgroundColor: isDark ? '#293548' : '#FFFFFF' }, preferences.theme === value && styles.choiceSelected]}
            onPress={() => savePreference('theme', value)}
            disabled={saving || !hydrated}
          >
            <Text style={[styles.choiceText, { color: isDark ? '#CBD5E1' : '#526267' }, preferences.theme === value && styles.choiceTextSelected]}>{t(value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F1F5F9' : '#24343A' }]}>{t('Text size')}</Text>
      </View>
      <View style={styles.choiceRow}>
        {['small', 'medium', 'large'].map((value) => (
          <TouchableOpacity
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: preferences.textSize === value }}
            style={[styles.choiceButton, { backgroundColor: isDark ? '#293548' : '#FFFFFF' }, preferences.textSize === value && styles.choiceSelected]}
            onPress={() => savePreference('textSize', value)}
            disabled={saving || !hydrated}
          >
            <Text style={[styles.choiceText, { color: isDark ? '#CBD5E1' : '#526267' }, preferences.textSize === value && styles.choiceTextSelected]}>{t(value === 'small' ? 'Small' : value === 'medium' ? 'Medium' : 'Large')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F1F5F9' : '#24343A' }]}>{t('Language')}</Text>
      </View>
      <View style={styles.choiceRow}>
        {['en', 'am'].map((value) => (
          <TouchableOpacity
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: preferences.language === value }}
            style={[styles.choiceButton, { backgroundColor: isDark ? '#293548' : '#FFFFFF' }, preferences.language === value && styles.choiceSelected]}
            onPress={() => savePreference('language', value)}
            disabled={saving || !hydrated}
          >
            <Text style={[styles.choiceText, { color: isDark ? '#CBD5E1' : '#526267' }, preferences.language === value && styles.choiceTextSelected]}>{t(value === 'en' ? 'English' : 'Amharic')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('Reset settings')}
        style={[styles.resetButton, saving && styles.disabledButton]}
        onPress={restoreDefaults}
        disabled={saving}
      >
        <Icon name="refresh" size={18} color="#116B5F" />
        <Text style={styles.resetText}>{t('Reset settings')}</Text>
      </TouchableOpacity>
      <Text style={styles.footer}>{t('Defaults: notifications, location sharing, SOS confirmation, and vibration are enabled.')}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8F7' },
  content: { padding: 20, paddingBottom: 36 },
  header: { paddingTop: 8, paddingBottom: 26 },
  headerIcon: { alignItems: 'center', justifyContent: 'center', width: 46, height: 46, marginBottom: 14, borderRadius: 14, backgroundColor: '#E4F3EE' },
  title: { color: '#24343A', fontSize: 27, fontWeight: '700' },
  subtitle: { marginTop: 6, color: '#718083', fontSize: 14, lineHeight: 20 },
  sectionHeading: { marginBottom: 10 },
  sectionTitle: { color: '#24343A', fontSize: 16, fontWeight: '700' },
  sectionCaption: { marginTop: 4, color: '#788588', fontSize: 12, lineHeight: 17 },
  card: { paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFFFF', elevation: 1, shadowColor: '#17313A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', minHeight: 76, gap: 11, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5ECEA' },
  optionIcon: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 11, backgroundColor: '#F0F7F4' },
  optionCopy: { flex: 1 },
  optionTitle: { color: '#293B40', fontSize: 14, fontWeight: '600' },
  optionDescription: { marginTop: 3, color: '#7A8789', fontSize: 11, lineHeight: 15 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 12, marginBottom: 26, padding: 13, borderRadius: 11, backgroundColor: '#EEF4FF' },
  noteText: { flex: 1, color: '#52677F', fontSize: 12, lineHeight: 18 },
  infoCard: { paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFFFF' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 15 },
  infoDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5ECEA' },
  infoCopy: { flex: 1 },
  infoTitle: { color: '#435257', fontSize: 13, fontWeight: '600' },
  infoDescription: { marginTop: 4, color: '#7A8789', fontSize: 11, lineHeight: 16 },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 24, borderWidth: 1, borderColor: '#C8DED6', borderRadius: 12, backgroundColor: '#FFFFFF' },
  resetText: { color: '#116B5F', fontSize: 13, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  choiceButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#D6E2DE', borderRadius: 11, backgroundColor: '#FFFFFF' },
  choiceSelected: { borderColor: '#116B5F', backgroundColor: '#E4F3EE' },
  choiceText: { color: '#435257', fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: '#116B5F', fontWeight: '700' },
  footer: { marginTop: 10, color: '#899497', fontSize: 11, textAlign: 'center' },
});

export default SettingsScreen;