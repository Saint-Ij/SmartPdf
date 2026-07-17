import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import type { Flashcard } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 120;

export default function FlashcardReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  const position = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const frontInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  useEffect(() => {
    loadAllCards();
  }, [id]);

  async function loadAllCards() {
    try {
      const first = await api.get<{ flashcard: Flashcard }>(`/flashcards/${id}`);
      const docCards = await api.get<{ flashcards: Flashcard[] }>(`/flashcards/document/${first.flashcard.documentId}`);
      const sorted = docCards.flashcards.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const startIndex = sorted.findIndex((c) => c.id === id);
      setCards(sorted);
      setCurrentIndex(startIndex >= 0 ? startIndex : 0);
    } catch {
      Alert.alert("Error", "Could not load flashcards");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  const flashcard = cards[currentIndex];
  const totalCards = cards.length;
  const isDone = !loading && totalCards > 0 && currentIndex >= totalCards;

  function flip() {
    setFlipped(!flipped);
    Animated.spring(rotateAnim, {
      toValue: flipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }

  function goToNext() {
    setFlipped(false);
    rotateAnim.setValue(0);
    position.setValue(0);
    setCurrentIndex((i) => i + 1);
  }

  async function markDifficulty(difficulty: number) {
    if (!flashcard) return;
    try {
      await api.patch(`/flashcards/${flashcard.id}/difficulty`, { difficulty });
      goToNext();
    } catch {
      Alert.alert("Error", "Could not update card");
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) > SWIPE_THRESHOLD) {
          const direction = gesture.dx > 0 ? 3 : 1;
          Animated.timing(position, {
            toValue: gesture.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            if (flashcard) {
              api.patch(`/flashcards/${flashcard.id}/difficulty`, {
                difficulty: direction,
              }).catch(() => {});
            }
            goToNext();
          });
        } else {
          Animated.spring(position, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (loading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (totalCards === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <IconSymbol size={64} name="rectangle.stack" color={colors.icon} />
        <ThemedText style={{ marginTop: 16, opacity: 0.6 }}>No flashcards to review</ThemedText>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.tint, marginTop: 24 }]} onPress={() => router.back()}>
          <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (isDone) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <IconSymbol size={64} name="checkmark.circle.fill" color="#34C759" />
        <ThemedText type="title" style={{ marginTop: 16 }}>All Done!</ThemedText>
        <ThemedText style={{ opacity: 0.6, marginTop: 8, marginBottom: 24 }}>
          Reviewed {totalCards} flashcards
        </ThemedText>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
          <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol size={24} name="xmark" color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={{ fontSize: 14, opacity: 0.6 }}>
          {currentIndex + 1} of {totalCards}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.cardContainer}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderColor: colors.icon + "30",
              transform: [
                { translateX: position },
                { perspective: 1000 },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={flip}
            style={styles.cardInner}
          >
            <Animated.View
              style={[
                styles.cardFace,
                { transform: [{ rotateY: frontInterpolate }] },
              ]}
            >
              <ThemedText style={styles.cardLabel}>FRONT</ThemedText>
              <ThemedText type="subtitle" style={styles.cardText}>
                {flashcard.front}
              </ThemedText>
              <ThemedText style={styles.tapHint}>Tap to flip</ThemedText>
            </Animated.View>

            <Animated.View
              style={[
                styles.cardFace,
                styles.cardBack,
                { transform: [{ rotateY: backInterpolate }] },
              ]}
            >
              <ThemedText style={styles.cardLabel}>BACK</ThemedText>
              <ThemedText type="subtitle" style={styles.cardText}>
                {flashcard.back}
              </ThemedText>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </ThemedView>

      {flipped && (
        <ThemedView style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#FF3B30" + "15" }]}
            onPress={() => markDifficulty(1)}
          >
            <IconSymbol size={20} name="arrow.counterclockwise" color="#FF3B30" />
            <ThemedText style={{ color: "#FF3B30", fontWeight: "600" }}>Review Again</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#34C759" + "15" }]}
            onPress={() => markDifficulty(3)}
          >
            <IconSymbol size={20} name="checkmark" color="#34C759" />
            <ThemedText style={{ color: "#34C759", fontWeight: "600" }}>Easy</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 30,
    paddingBottom: 8,
  },
  cardContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  card: {
    width: "100%",
    height: 300,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  cardInner: { flex: 1 },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backfaceVisibility: "hidden",
  },
  cardBack: { transform: [{ rotateY: "180deg" }] },
  cardLabel: { fontSize: 11, fontWeight: "700", opacity: 0.4, letterSpacing: 2, marginBottom: 12 },
  cardText: { textAlign: "center", lineHeight: 28 },
  tapHint: { position: "absolute", bottom: 20, fontSize: 12, opacity: 0.3 },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
});
