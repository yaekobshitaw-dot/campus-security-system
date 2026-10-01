import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';

const lightPalette = {
  background: '#F5F8F7',
  surface: '#FFFFFF',
  text: '#24343A',
  muted: '#657278',
};

const darkPalette = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  muted: '#CBD5E1',
};

export const useMobileTheme = () => {
  const selectedTheme = useSelector((state) => state.settings.preferences.theme);
  const deviceScheme = useColorScheme();
  const isDark = selectedTheme === 'dark' || (selectedTheme === 'system' && deviceScheme === 'dark');

  return {
    isDark,
    colors: isDark ? darkPalette : lightPalette,
  };
};
