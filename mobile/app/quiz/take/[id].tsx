import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api, ApiError } from "@/lib/api";
import type { Quiz, QuizQuestion, QuizAttempt } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function QuizTakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    score: number;
    passed: boolean;
    correct: number;
    total: number;
    answers: QuizQuestion[];
  } | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [id]);

  async function loadQuiz() {
    try {
      const qData = await api.get<{ quiz: Quiz }>(`/quizzes/${id}`);
      setQuiz(qData.quiz);
      const qsData = await api.get<{ questions: QuizQuestion[] }>(`/quizzes/${id}/questions`);
      setQuestions(qsData.questions);
    } catch {
      Alert.alert("Error", "Could not load quiz");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  const current = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  function selectAnswer(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  function next() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }

  function prev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }

  async function handleSubmit() {
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      Alert.alert(
        "Incomplete",
        `You have ${unanswered.length} unanswered question(s). Submit anyway?`,
        [
          { text: "Review", style: "cancel" },
          { text: "Submit", onPress: submitQuiz },
        ],
      );
    } else {
      submitQuiz();
    }
  }

  async function submitQuiz() {
    setSubmitting(true);
    try {
      const result = await api.post<{
        attempt: QuizAttempt;
        score: number;
        passed: boolean;
        correct: number;
        total: number;
      }>(`/quizzes/${id}/submit`, { answers });
      const answersData = await api.get<{ questions: QuizQuestion[] }>(`/quizzes/${id}/answers`);
      setSubmissionResult({
        score: result.score,
        passed: result.passed,
        correct: result.correct,
        total: result.total,
        answers: answersData.questions,
      });
      setAttempt(result.attempt);
      setCompleted(true);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not submit quiz";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setAnswers({});
    setCurrentIndex(0);
    setCompleted(false);
    setAttempt(null);
  }

  if (loading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (completed && submissionResult && attempt) {
    const { passed, score, correct, total, answers: answerQuestions } = submissionResult;
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedView style={styles.resultContainer}>
          <IconSymbol
            size={64}
            name={passed ? "checkmark.circle.fill" : "xmark.circle.fill"}
            color={passed ? "#34C759" : "#FF3B30"}
          />
          <ThemedText type="title" style={{ marginTop: 16 }}>
            {passed ? "Passed!" : "Try Again"}
          </ThemedText>
          <ThemedText style={styles.scoreText}>
            {score}% · {correct}/{total} correct
          </ThemedText>
          <ThemedView style={styles.resultDetails}>
            {answerQuestions.map((q, i) => (
              <ThemedView key={q.id} style={styles.resultRow}>
                <IconSymbol
                  size={16}
                  name={answers[q.id] === q.correctAnswer ? "checkmark" : "xmark"}
                  color={answers[q.id] === q.correctAnswer ? "#34C759" : "#FF3B30"}
                />
                <ThemedText style={styles.resultQ} numberOfLines={2}>
                  {i + 1}. {q.question}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
          <ThemedView style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.resultBtn, { borderColor: colors.tint, borderWidth: 1 }]}
              onPress={reset}
            >
              <ThemedText style={{ color: colors.tint, fontWeight: "600" }}>Retry</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: colors.tint }]}
              onPress={() => router.back()}
            >
              <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Done</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    );
  }

  if (!current) {
    return (
      <ThemedView style={styles.loading}>
        <ThemedText>No questions in this quiz</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Progress */}
      <ThemedView style={styles.progressContainer}>
        <ThemedView style={[styles.progressBar, { backgroundColor: colors.icon + "20" }]}>
          <ThemedView
            style={[styles.progressFill, { backgroundColor: colors.tint, width: `${progress}%` }]}
          />
        </ThemedView>
        <ThemedText style={styles.progressText}>
          {currentIndex + 1} of {questions.length}
        </ThemedText>
      </ThemedView>

      <ScrollView contentContainerStyle={styles.questionContainer}>
        <ThemedText type="subtitle" style={styles.questionText}>
          {current.question}
        </ThemedText>

        <ThemedView style={styles.options}>
          {current.options.map((option, i) => {
            const selected = answers[current.id] === option;
            const letters = ["A", "B", "C", "D", "E", "F"];
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? colors.tint : colors.icon + "30",
                    backgroundColor: selected ? colors.tint + "10" : "transparent",
                  },
                ]}
                onPress={() => selectAnswer(current.id, option)}
              >
                <ThemedView
                  style={[
                    styles.optionCircle,
                    {
                      backgroundColor: selected ? colors.tint : "transparent",
                      borderColor: selected ? colors.tint : colors.icon,
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.optionLetter, { color: selected ? "#fff" : colors.icon }]}
                  >
                    {letters[i] || i}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.optionText}>{option}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </ThemedView>
      </ScrollView>

      {/* Navigation */}
      <ThemedView style={[styles.nav, { borderTopColor: colors.icon + "20" }]}>
        <TouchableOpacity
          style={[styles.navBtn, { borderColor: colors.icon + "30", borderWidth: 1 }]}
          onPress={prev}
          disabled={currentIndex === 0}
        >
          <IconSymbol size={16} name="chevron.left" color={currentIndex === 0 ? colors.icon + "40" : colors.text} />
          <ThemedText style={{ color: currentIndex === 0 ? colors.icon + "40" : colors.text }}>Prev</ThemedText>
        </TouchableOpacity>

        {currentIndex === questions.length - 1 ? (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.tint }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Submit</ThemedText>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.tint }]}
            onPress={next}
          >
            <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Next</ThemedText>
            <IconSymbol size={16} name="chevron.right" color="#fff" />
          </TouchableOpacity>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  progressContainer: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 14, opacity: 0.6, textAlign: "right" },
  questionContainer: { padding: 20, paddingBottom: 100 },
  questionText: { marginBottom: 24, lineHeight: 28 },
  options: { gap: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  optionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLetter: { fontSize: 14, fontWeight: "700" },
  optionText: { flex: 1, fontSize: 16 },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  resultContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  scoreText: { fontSize: 20, fontWeight: "600", marginTop: 8, opacity: 0.7 },
  resultDetails: { width: "100%", marginTop: 24, gap: 8 },
  resultRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  resultQ: { flex: 1, fontSize: 14, opacity: 0.7 },
  resultActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  resultBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, alignItems: "center", minWidth: 100 },
});
