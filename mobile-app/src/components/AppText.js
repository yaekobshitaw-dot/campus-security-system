import { useSelector } from 'react-redux';
import { StyleSheet, Text as NativeText } from 'react-native';
import { useMobileTheme } from '../utils/settingsAppearance';
import { useMobileTranslation } from '../utils/translations';

const textSizeFactors = { small: 0.92, medium: 1, large: 1.12 };
const darkPrimaryColors = new Set(['#24343A', '#293B40', '#333333', '#333']);
const darkMutedColors = new Set([
  '#444444', '#444', '#435257', '#526267', '#657278', '#666666', '#666',
  '#718083', '#788588', '#7A8789', '#999999', '#999',
]);

const AppText = ({ style, ...props }) => {
  const textSize = useSelector((state) => state.settings.preferences.textSize);
  const { isDark, colors } = useMobileTheme();
  const t = useMobileTranslation();
  const flattenedStyle = StyleSheet.flatten(style);
  const factor = textSizeFactors[textSize] || textSizeFactors.medium;
  const scaledStyle = Number.isFinite(flattenedStyle?.fontSize)
    ? { fontSize: flattenedStyle.fontSize * factor }
    : undefined;
  const normalizedColor = String(flattenedStyle?.color || '').toUpperCase();
  const isDarkNeutral = darkPrimaryColors.has(normalizedColor) || darkMutedColors.has(normalizedColor);
  const themeStyle = isDark && (!flattenedStyle?.color || isDarkNeutral)
    ? { color: darkPrimaryColors.has(normalizedColor) || !flattenedStyle?.color ? colors.text : colors.muted }
    : undefined;

  const children = typeof props.children === 'string' ? t(props.children) : props.children;
  return <NativeText {...props} style={[style, themeStyle, scaledStyle]}>{children}</NativeText>;
};

export default AppText;
