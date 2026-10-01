import { StyleSheet, TextInput as NativeTextInput } from 'react-native';
import { useSelector } from 'react-redux';

const textSizeFactors = { small: 0.92, medium: 1, large: 1.12 };

const AppTextInput = ({ style, ...props }) => {
  const textSize = useSelector((state) => state.settings.preferences.textSize);
  const flattenedStyle = StyleSheet.flatten(style);
  const factor = textSizeFactors[textSize] || textSizeFactors.medium;
  const scaledStyle = Number.isFinite(flattenedStyle?.fontSize)
    ? { fontSize: flattenedStyle.fontSize * factor }
    : undefined;

  return <NativeTextInput {...props} style={scaledStyle ? [style, scaledStyle] : style} />;
};

export default AppTextInput;
