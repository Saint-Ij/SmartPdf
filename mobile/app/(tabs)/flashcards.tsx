import { useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import type { Flashcard } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function FlashcardsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ documents: Array<{ id: string; title: string }> }>("/documents");
      const all: Array<Flashcard & { documentTitle?: string }> = [];
      for (const doc of data.documents) {
        try {
          const f = await api.get<{ flashcards: Flashcard[] }>(`/flashcards/document/${doc.id}`);
          for (const card of f.flashcards) {
            (card as any).documentTitle = doc.title;
            all.push(card as any);
          }
        } catch { /* no cards */ }
      }
      setCards(all);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function getDifficultyLabel(d: number) {
    if (d <= 1) return "Easy";
    if (d <= 2) return "Medium";
    return "Hard";
  }

  function getDifficultyColor(d: number) {
    if (d <= 1) return "#34C759";
    if (d <= 2) return "#FF9500";
    return "#FF3B30";
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
      <ThemedView style={styles.header}>
        <ThemedText type="title">Flashcards</ThemedText>
        <ThemedText style={styles.count}>{cards.length} cards</ThemedText>
      </ThemedView>

      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={
          <ThemedView style={styles.empty}>
            <IconSymbol size={64} name="rectangle.stack" color={colors.icon} />
            <ThemedText style={styles.emptyTitle}>No flashcards yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Generate flashcards from your documents in the Reader
            </ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderColor: colors.icon + "30" }]}
            onPress={() => router.push(`/flashcard/review/${item.id}` as any)}
          >
            <ThemedView style={styles.cardInfo}>
              <ThemedText type="defaultSemiBold" numberOfLines={2}>{item.front}</ThemedText>
              <ThemedText style={styles.cardMeta} numberOfLines={1}>
                {(item as any).documentTitle ? (item as any).documentTitle : ""}
                {item.sectionTitle ? ` · ${item.sectionTitle}` : ""}
                {item.back ? ` · ${item.back}` : ""}
              </ThemedText>
            </ThemedView>
            <ThemedView
              style={[styles.badge, { backgroundColor: getDifficultyColor(item.difficulty) + "20" }]}
            >
              <ThemedText
                style={[styles.badgeText, { color: getDifficultyColor(item.difficulty) }]}
              >
                {getDifficultyLabel(item.difficulty)}
              </ThemedText>
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
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 8 },
  count: { fontSize: 14, opacity: 0.6, marginTop: 4 },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardInfo: { flex: 1, marginRight: 8 },
  cardMeta: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  emptySubtitle: { fontSize: 14, opacity: 0.6, textAlign: "center", paddingHorizontal: 40 },
});
