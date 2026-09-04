import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

export const SOSButton = ({ onPress, disabled = false }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startPulseAnimation();
    startBreathingAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startBreathingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.03,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim.interpolate({
              inputRange: [1, 1.2],
              outputRange: [0.6, 0],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.sosContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.sosButton, disabled && styles.disabled]}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Icon name="emergency" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.subText}>Emergency</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#D64545',
    opacity: 0.3,
  },
  sosContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#D64545',
    shadowColor: '#D64545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sosButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 75,
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    marginBottom: 2,
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
    fontWeight: '500',
    letterSpacing: 1,
  },
});

export default SOSButton;