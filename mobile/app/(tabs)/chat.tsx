import { useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await api.get<{ conversations: Conversation[] }>("/conversations");
      setConversations(data.conversations);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(conv: Conversation) {
    Alert.alert("Delete Conversation", `Delete "${conv.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/conversations/${conv.id}`);
            await load();
          } catch {
            Alert.alert("Error", "Could not delete conversation");
          }
        },
      },
    ]);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function timeAgo(date: string) {
    if (!date) return "";
    const time = new Date(date).getTime();
    if (Number.isNaN(time)) return "";
    const diff = Date.now() - time;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  if (loading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <ThemedText type="title">Chats</ThemedText>
        <ThemedText style={styles.count}>{conversations.length} conversations</ThemedText>
      </ThemedView>

      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={
          <ThemedView style={styles.empty}>
            <IconSymbol size={64} name="bubble.left" color={colors.icon} />
            <ThemedText style={styles.emptyTitle}>No conversations yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Open a document from your Library to start chatting
            </ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderColor: colors.icon + "30" }]}
            onPress={() => router.push(`/conversation/${item.id}` as any)}
            onLongPress={() => deleteConversation(item)}
          >
            <ThemedView style={styles.cardIcon}>
              <IconSymbol size={24} name="bubble.left.fill" color={colors.tint} />
            </ThemedView>
            <ThemedView style={styles.cardInfo}>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>{item.title}</ThemedText>
              <ThemedText style={styles.cardMeta} numberOfLines={1}>{item.documentTitle || "Unknown document"} · {timeAgo(item.updatedAt)}</ThemedText>
            </ThemedView>
          </TouchableOpacity>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  count: { fontSize: 14, opacity: 0.6, marginTop: 4 },
  list: { padding: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardIcon: { marginRight: 12 },
  cardInfo: { flex: 1 },
  cardMeta: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  empty: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  emptySubtitle: { fontSize: 14, opacity: 0.6, textAlign: "center", paddingHorizontal: 40 },
});
