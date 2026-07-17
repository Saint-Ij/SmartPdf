import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
  }, [id]);

  async function loadMessages() {
    try {
      const data = await api.get<{ messages: Message[] }>(`/conversations/${id}/messages`);
      setMessages(data.messages);
    } catch {
      Alert.alert("Error", "Could not load messages");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      conversationId: id,
      role: "user",
      content: text,
      sourceChunkIds: [],
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await api.post<{ message: Message }>(
        `/conversations/${id}/chat`,
        { content: text },
      );
      setMessages((prev) => [...prev, res.message]);
    } catch {
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={insets.top + 44}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ThemedView
            style={[
              styles.bubble,
              item.role === "user"
                ? [styles.userBubble, { backgroundColor: colors.tint }]
                : [styles.assistantBubble, { backgroundColor: colors.icon + "15" }],
            ]}
          >
            <ThemedText
              style={item.role === "user" ? { color: "#fff" } : {}}
            >
              {item.content}
            </ThemedText>
          </ThemedView>
        )}
        ListEmptyComponent={
          <ThemedView style={styles.empty}>
            <IconSymbol size={48} name="bubble.left" color={colors.icon} />
            <ThemedText style={styles.emptyText}>Start a conversation</ThemedText>
          </ThemedView>
        }
      />

      <ThemedView
        style={[
          styles.inputBar,
          { borderTopColor: colors.icon + "20", paddingBottom: insets.bottom + 12 },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon + "30" }]}
          placeholder="Ask a question..."
          placeholderTextColor={colors.icon}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.tint }]}
          onPress={handleSend}
          disabled={sending || !input.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <IconSymbol size={18} name="arrow.up" color="#fff" />
          )}
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 8 },
  bubble: { padding: 14, borderRadius: 20, maxWidth: "85%", marginVertical: 4 },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 16, opacity: 0.5 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
