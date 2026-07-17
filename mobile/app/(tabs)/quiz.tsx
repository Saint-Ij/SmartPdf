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
import type { Quiz } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function QuizzesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ quizzes: Quiz[] }>("/quizzes/all");
      setQuizzes(data.quizzes);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function getStatusColor(status: string) {
    switch (status) {
      case "passed": return "#34C759";
      case "failed": return "#FF3B30";
      case "in_progress": return "#FF9500";
      default: return colors.icon;
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
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Quizzes</ThemedText>
        <ThemedText style={styles.count}>{quizzes.length} quizzes</ThemedText>
      </ThemedView>

      <FlatList
        data={quizzes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={
          <ThemedView style={styles.empty}>
            <IconSymbol size={64} name="checkmark.circle" color={colors.icon} />
            <ThemedText style={styles.emptyTitle}>No quizzes yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Generate quizzes from your documents in the Reader
            </ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderColor: colors.icon + "30" }]}
            onPress={() => router.push(`/quiz/take/${item.id}` as any)}
          >
            <ThemedView style={styles.cardInfo}>
              <ThemedText type="defaultSemiBold" numberOfLines={1}>
                {item.documentTitle || `Quiz #${item.id.slice(0, 8)}`}
              </ThemedText>
              <ThemedText style={styles.cardMeta}>
                {item.documentTitle}{item.sectionTitle ? ` · ${item.sectionTitle}` : ""} · {item.totalQuestions} questions · Pass: {item.passingScore}%
              </ThemedText>
            </ThemedView>
            <ThemedView
              style={[styles.badge, { backgroundColor: getStatusColor(item.status) + "20" }]}
            >
              <ThemedText
                style={[styles.badgeText, { color: getStatusColor(item.status) }]}
              >
                {item.status.replace("_", " ")}
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
  cardInfo: { flex: 1 },
  cardMeta: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  badgeText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  empty: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  emptySubtitle: { fontSize: 14, opacity: 0.6, textAlign: "center", paddingHorizontal: 40 },
});
