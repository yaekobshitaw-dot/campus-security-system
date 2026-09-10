import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../components/ui';
import api from '../services/api';

const promptsByRole = {
  student: ['How do I report an incident?', 'What does In Progress mean?', 'What is my latest incident status?', 'How do I send SOS?'],
  faculty: ['How do I report an incident?', 'What does In Progress mean?', 'What should I do during a fire?'],
  staff: ['How do I report an incident?', 'What does In Progress mean?', 'What should I do during an emergency?'],
  security: ['What incidents are assigned to me?', 'What does On Scene mean?', 'How does the response workflow work?'],
  admin: ['What are the current incident statistics?', 'How does officer assignment work?', 'How does the security workflow work?'],
};

const AssistantScreen = () => {
  const { user } = useSelector((state) => state.auth);
  const [messages, setMessages] = useState([{ text: 'Hello! I\'m your Campus Security Assistant. How can I help?', sender: 'assistant' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollViewRef = useRef(null);
  const prompts = promptsByRole[user?.role] || promptsByRole.student;

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const sendMessage = async (value = input) => {
    const message = value.trim();
    if (!message || loading) return;
    setInput('');
    setError('');
    setMessages((current) => [...current, { text: message, sender: 'user' }]);
    setLoading(true);
    try {
      const response = await api.post('/assistant/chat', { message });
      setMessages((current) => [...current, { text: response.data.message, sender: 'assistant' }]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The assistant is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Icon name="smart-toy" size={23} color={colors.teal} /></View>
        <View><Text style={styles.title}>AI Security Assistant</Text><Text style={styles.subtitle}>Read-only, role-aware guidance</Text></View>
      </View>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
        {messages.map((message, index) => <View key={`${message.sender}-${index}`} style={[styles.message, message.sender === 'user' ? styles.userMessage : styles.assistantMessage]}><Text style={[styles.messageText, message.sender === 'user' && styles.userMessageText]}>{message.text}</Text></View>)}
        {loading && <View style={[styles.message, styles.assistantMessage]}><Text style={styles.mutedText}>Thinking...</Text></View>}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptRow} keyboardShouldPersistTaps="handled">
        {prompts.map((prompt) => <TouchableOpacity key={prompt} style={styles.prompt} onPress={() => sendMessage(prompt)} disabled={loading}><Text style={styles.promptText}>{prompt}</Text></TouchableOpacity>)}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask a security question..." placeholderTextColor={colors.muted} maxLength={2000} editable={!loading} onSubmitEditing={() => sendMessage()} returnKeyType="send" />
        <TouchableOpacity style={[styles.sendButton, (!input.trim() || loading) && styles.disabledButton]} onPress={() => sendMessage()} disabled={!input.trim() || loading} accessibilityRole="button" accessibilityLabel="Send assistant message"><Icon name="send" size={21} color={colors.surface} /></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tealSoft },
  title: { marginLeft: 12, color: colors.ink, fontSize: 19, fontWeight: '700' },
  subtitle: { marginLeft: 12, marginTop: 3, color: colors.muted, fontSize: 12 },
  messages: { padding: 16, paddingBottom: 10, flexGrow: 1, justifyContent: 'flex-end' },
  message: { maxWidth: '86%', marginBottom: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16 },
  assistantMessage: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  userMessage: { alignSelf: 'flex-end', backgroundColor: colors.teal },
  messageText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  userMessageText: { color: colors.surface },
  mutedText: { color: colors.muted, fontSize: 14 },
  error: { alignSelf: 'center', marginVertical: 8, color: colors.danger, fontSize: 12 },
  promptRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  prompt: { maxWidth: 230, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.teal, backgroundColor: colors.tealSoft },
  promptText: { color: colors.teal, fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, minHeight: 44, maxHeight: 100, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, color: colors.ink, backgroundColor: colors.canvas },
  sendButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal },
  disabledButton: { opacity: 0.45 },
});

export default AssistantScreen;
