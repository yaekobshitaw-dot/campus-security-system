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
import { useDispatch } from 'react-redux';
import CampusSecurityBackground from '../assets/images/campus-security-background.svg';
import { Icon } from '../components/ui';
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
      <StatusBar barStyle="dark-content" backgroundColor="#F5F8F7" />
      <CampusSecurityBackground style={styles.backgroundImage} width="100%" height="100%" />
      <View style={styles.overlay} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandMark}><Icon name="shield" size={30} color="#116B5F" /></View>
          <Text style={styles.title}>Campus Security</Text>
          <Text style={styles.subtitle}>Emergency Response System</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Icon name="email" size={20} color="#116B5F" style={styles.inputIcon} />
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
            <Icon name="lock" size={20} color="#116B5F" style={styles.inputIcon} />
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
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#116B5F" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPassword}>
            <Icon name="help-outline" size={17} color="#116B5F" />
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.loginButton, loading && styles.disabled]} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <><Icon name="login" size={20} color="#FFFFFF" /><Text style={styles.loginButtonText}>Sign in</Text></>
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
  container: { flex: 1, backgroundColor: '#F5F8F7' },
  backgroundImage: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(245, 248, 247, 0.9)' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', minHeight: '100%', paddingHorizontal: 20, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 28 },
  brandMark: { alignItems: 'center', justifyContent: 'center', width: 58, height: 58, marginBottom: 14, borderRadius: 18, backgroundColor: '#E4F3EE', borderWidth: 1, borderColor: '#C8DED6' },
  title: { color: '#24343A', fontSize: 28, fontWeight: 'bold' },
  subtitle: { marginTop: 8, color: '#718083', fontSize: 16 },
  form: { width: '100%', padding: 18, borderWidth: 1, borderColor: '#E0EAE6', borderRadius: 14, backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#17313A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 7 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', minHeight: 54, marginBottom: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D6E2DE', borderRadius: 10, backgroundColor: '#F8FBFA' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: '#293B40', fontSize: 16 },
  eyeIcon: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 },
  forgotPassword: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5, minHeight: 44, marginBottom: 18 },
  forgotPasswordText: { color: '#116B5F', fontSize: 14 },
  loginButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, marginBottom: 20, paddingHorizontal: 16, borderRadius: 11, backgroundColor: '#116B5F' },
  disabled: { opacity: 0.7 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  registerText: { color: '#718083', fontSize: 14 },
  registerLink: { color: '#116B5F', fontSize: 14, fontWeight: '700' },
});

export default LoginScreen;
