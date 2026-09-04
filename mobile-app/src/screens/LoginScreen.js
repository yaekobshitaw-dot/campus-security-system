import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch } from 'react-redux';
import CampusSecurityBackground from '../assets/images/campus-security-background.svg';
import { login } from '../store/authSlice';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await dispatch(login({ email, password })).unwrap();
    } catch (error) {
      const message = typeof error === 'string' ? error : error.message;
      Alert.alert('Login Failed', message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#102B36" />
      <CampusSecurityBackground style={styles.backgroundImage} width="100%" height="100%" />
      <View style={styles.overlay} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandMark}><Icon name="shield" size={30} color="#B8E8D7" /></View>
          <Text style={styles.title}>Campus Security</Text>
          <Text style={styles.subtitle}>Emergency Response System</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Icon name="email" size={20} color="#B8E8D7" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9BB1B2"
            />
          </View>

          <View style={styles.inputContainer}>
            <Icon name="lock" size={20} color="#B8E8D7" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#9BB1B2"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#B8E8D7" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPassword}>
            <Icon name="help-outline" size={17} color="#B8E8D7" />
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.loginButton, loading && styles.disabled]} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#102B36" />
            ) : (
              <><Icon name="login" size={20} color="#102B36" /><Text style={styles.loginButtonText}>Sign in</Text></>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#102B36' },
  backgroundImage: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 19, 27, 0.62)' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', minHeight: '100%', paddingHorizontal: 20, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 28 },
  brandMark: { alignItems: 'center', justifyContent: 'center', width: 58, height: 58, marginBottom: 14, borderRadius: 18, backgroundColor: 'rgba(184, 232, 215, 0.14)', borderWidth: 1, borderColor: 'rgba(184, 232, 215, 0.35)' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
  subtitle: { marginTop: 8, color: '#C7D9D7', fontSize: 16 },
  form: { width: '100%', padding: 18, borderWidth: 1, borderColor: 'rgba(184, 232, 215, 0.28)', borderRadius: 18, backgroundColor: 'rgba(8, 29, 38, 0.76)' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', minHeight: 54, marginBottom: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(184, 232, 215, 0.35)', borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: '#FFFFFF', fontSize: 16 },
  eyeIcon: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 },
  forgotPassword: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5, minHeight: 44, marginBottom: 18 },
  forgotPasswordText: { color: '#B8E8D7', fontSize: 14 },
  loginButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, marginBottom: 20, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#B8E8D7' },
  disabled: { opacity: 0.7 },
  loginButtonText: { color: '#102B36', fontSize: 16, fontWeight: '700' },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  registerText: { color: '#C7D9D7', fontSize: 14 },
  registerLink: { color: '#B8E8D7', fontSize: 14, fontWeight: '700' },
});

export default LoginScreen;
