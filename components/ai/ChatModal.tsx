import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { chatWithAssistant, ChatResponse, ChatMessage } from '../../services/api/claude';
import ChatMessageBubble from './ChatMessage';

type MessageItem =
  | { role: 'user'; content: string }
  | { role: 'assistant'; data: ChatResponse }
  | { role: 'error'; content: string };

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ChatModal({ visible, onClose }: Props) {
  const { themeColors } = useTheme();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible) {
      setMessages([]);
      setInput('');
    }
  }, [visible]);

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // chatWithAssistant()에 넘길 히스토리 추출
  const toChatHistory = (msgs: MessageItem[]): ChatMessage[] =>
    msgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.role === 'user' ? (m as any).content : (m as any).data.message,
      }));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: MessageItem = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const history = toChatHistory(messages);
      const data = await chatWithAssistant(text, history);
      if (!data.message) data.message = '(응답이 비어있습니다)';
      setMessages(prev => [...prev, { role: 'assistant', data }]);
      scrollToBottom();
    } catch (e: any) {
      const errMsg = e?.message ?? 'AI 응답을 불러오지 못했습니다.';
      setMessages(prev => [...prev, { role: 'error', content: errMsg }]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  const QUICK_QUESTIONS = [
    '이 앱 어떻게 사용해?',
    'ISA 계좌가 뭐야?',
    '배당금은 어디서 봐?',
    '세금 절약 방법은?',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.sheet, { backgroundColor: themeColors.background }]}
        >
          {/* 헤더 */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.robotBadge, { backgroundColor: themeColors.primary + '22' }]}>
                <Text style={styles.robotEmoji}>🤖</Text>
              </View>
              <View>
                <Text style={[styles.title, { color: themeColors.text }]}>AI 도우미</Text>
                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                  앱 사용법, 투자 용어 무엇이든 물어보세요
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {/* 메시지 목록 */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyRobot}>🤖</Text>
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                  안녕하세요! 무엇이든 물어보세요
                </Text>
                <Text style={[styles.emptyDesc, { color: themeColors.textSecondary }]}>
                  포트폴리오 앱 사용법, 투자 용어,{'\n'}세금 절약 방법 등을 안내해드려요
                </Text>
                <View style={styles.quickWrap}>
                  {QUICK_QUESTIONS.map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={[styles.quickBtn, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
                      onPress={() => setInput(q)}
                    >
                      <Text style={[styles.quickBtnText, { color: themeColors.text }]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => {
              // 에러
              if (item.role === 'error') {
                return (
                  <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#FF3B3022' }]}>
                      <Text style={{ fontSize: 14 }}>⚠️</Text>
                    </View>
                    <View style={[styles.bubble, { backgroundColor: '#FF3B3015', borderColor: '#FF3B3050', borderWidth: 1 }]}>
                      <Text style={[styles.bubbleText, { color: '#FF3B30' }]}>{item.content}</Text>
                    </View>
                  </View>
                );
              }
              // 사용자 메시지
              if (item.role === 'user') {
                return (
                  <View style={[styles.bubbleRow, styles.bubbleRowUser]}>
                    <View style={[styles.bubble, { backgroundColor: themeColors.primary }]}>
                      <Text style={[styles.bubbleText, { color: '#fff' }]}>{item.content}</Text>
                    </View>
                  </View>
                );
              }
              // AI 응답 — 구조화된 ChatMessage 컴포넌트 사용
              return (
                <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                  <View style={[styles.avatarCircle, { backgroundColor: themeColors.primary + '22' }]}>
                    <Text style={{ fontSize: 14 }}>🤖</Text>
                  </View>
                  <ChatMessageBubble data={item.data} />
                </View>
              );
            }}
          />

          {/* 타이핑 중 인디케이터 */}
          {isLoading && (
            <View style={styles.loadingRow}>
              <View style={[styles.avatarCircle, { backgroundColor: themeColors.primary + '22' }]}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={[styles.bubble, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border, borderWidth: 1 }]}>
                <ActivityIndicator size="small" color={themeColors.primary} />
              </View>
            </View>
          )}

          {/* 입력창 */}
          <View style={[styles.inputRow, { borderTopColor: themeColors.border, backgroundColor: themeColors.background }]}>
            <TextInput
              style={[styles.textInput, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border, color: themeColors.text }]}
              value={input}
              onChangeText={setInput}
              placeholder="메시지를 입력하세요..."
              placeholderTextColor={themeColors.textSecondary}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSend}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() && !isLoading ? themeColors.primary : themeColors.border }]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  robotBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  robotEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  messageList: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 8,
  },
  emptyRobot: {
    fontSize: 52,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  quickWrap: {
    gap: 8,
    width: '100%',
  },
  quickBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
