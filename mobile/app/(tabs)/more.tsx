import { useState, useCallback } from "react";
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import { clearAuth, getUser, saveUser } from "@/lib/storage";
import type { User, Summary, Reminder } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function MoreScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [user, setUser] = useState<User | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAllSummaries, setShowAllSummaries] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const me = await api.get<{ user: User }>("/auth/me");
      setUser(me.user);
      await saveUser(me.user);
    } catch {
      const u = await getUser();
      setUser(u);
    }
    try {
      const r = await api.get<{ reminders: Reminder[] }>("/reminders");
      setReminders(r.reminders.slice(0, 3));
    } catch { /* silent */ }
    try {
      const data = await api.get<{ documents: Array<{ id: string }> }>("/documents");
      const all: Summary[] = [];
      for (const doc of data.documents) {
        try {
          const s = await api.get<{ summaries: Summary[] }>(`/summaries/document/${doc.id}`);
          all.push(...s.summaries);
        } catch { /* none */ }
      }
      setSummaries(all);
    } catch { /* silent */ }
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await clearAuth();
          router.replace("/(auth)/login" as any);
        },
      },
    ]);
  }

  async function dismissReminder(r: Reminder) {
    try {
      await api.patch(`/reminders/${r.id}/status`, { status: "dismissed" });
      const stored = await AsyncStorage.getItem("reminder_notifs");
      if (stored) {
        const map: Record<string, string> = JSON.parse(stored);
        const notifId = map[r.id];
        if (notifId) {
          try {
            const Notifications = await import("expo-notifications");
            await Notifications.cancelScheduledNotificationAsync(notifId);
          } catch {}
          delete map[r.id];
          await AsyncStorage.setItem("reminder_notifs", JSON.stringify(map));
        }
      }
      setReminders((prev) => prev.filter((x) => x.id !== r.id));
    } catch {
      Alert.alert("Error", "Could not dismiss reminder");
    }
  }

  function createReminder() {
    Alert.alert("New Reminder", "When should we remind you?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "1 hour",
        onPress: () => scheduleReminder(1),
      },
      {
        text: "6 hours",
        onPress: () => scheduleReminder(6),
      },
      {
        text: "1 day",
        onPress: () => scheduleReminder(24),
      },
      {
        text: "3 days",
        onPress: () => scheduleReminder(72),
      },
    ]);
  }

  async function scheduleReminder(hours: number) {
    const scheduledFor = new Date(Date.now() + hours * 3600000);
    try {
      const { reminder } = await api.post<{ reminder: Reminder }>("/reminders", { scheduledFor: scheduledFor.toISOString() });

      try {
        const Notifications = await import("expo-notifications");
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          const trigger = new Date(scheduledFor.getTime());
          const notifId = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Study Reminder",
              body: "Time to review your documents!",
            },
            trigger,
          });
          const stored = await AsyncStorage.getItem("reminder_notifs");
          const map: Record<string, string> = stored ? JSON.parse(stored) : {};
          map[reminder.id] = notifId;
          await AsyncStorage.setItem("reminder_notifs", JSON.stringify(map));
        }
      } catch {
        // Notifications not available (Expo Go / web) — reminder saved server-side only
      }

      const r = await api.get<{ reminders: Reminder[] }>("/reminders");
      setReminders(r.reminders.slice(0, 3));
    } catch {
      Alert.alert("Error", "Could not create reminder");
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">More</ThemedText>
      </ThemedView>

      {/* Profile */}
      <ThemedView style={[styles.section, { borderColor: colors.icon + "20" }]}>
        <ThemedView style={styles.sectionHeader}>
          <IconSymbol size={20} name="person.circle.fill" color={colors.tint} />
          <ThemedText type="defaultSemiBold"> Profile</ThemedText>
        </ThemedView>
        {user && (
          <ThemedView style={styles.profileInfo}>
            <ThemedText>{user.name}</ThemedText>
            <ThemedText style={{ fontSize: 14, opacity: 0.6 }}>{user.email}</ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      {/* Summaries */}
      <ThemedView style={[styles.section, { borderColor: colors.icon + "20" }]}>
        <ThemedView style={styles.sectionHeader}>
          <IconSymbol size={20} name="text.alignleft" color={colors.tint} />
          <ThemedText type="defaultSemiBold"> Recent Summaries</ThemedText>
        </ThemedView>
        {summaries.length === 0 ? (
          <ThemedText style={styles.emptyText}>No summaries generated yet</ThemedText>
        ) : (
          (showAllSummaries ? summaries : summaries.slice(0, 3)).map((s) => (
            <ThemedText key={s.id} numberOfLines={2} style={styles.summaryItem}>
              {s.content.slice(0, 120)}...
            </ThemedText>
          ))
        )}
        {summaries.length > 3 && (
          <TouchableOpacity onPress={() => setShowAllSummaries(!showAllSummaries)}>
            <ThemedText style={[styles.seeAll, { color: colors.tint }]}>
              {showAllSummaries ? "Show less" : `See all ${summaries.length} summaries`}
            </ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>

      {/* Upcoming Reminders */}
      <ThemedView style={[styles.section, { borderColor: colors.icon + "20" }]}>
        <ThemedView style={styles.sectionHeader}>
          <IconSymbol size={20} name="bell.fill" color={colors.tint} />
          <ThemedText type="defaultSemiBold"> Upcoming Reminders</ThemedText>
        </ThemedView>
        {reminders.length === 0 ? (
          <ThemedText style={styles.emptyText}>No reminders set</ThemedText>
        ) : (
          reminders.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.reminderItem}
              onLongPress={() => dismissReminder(r)}
            >
              <ThemedText>
                {new Date(r.scheduledFor).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
              <ThemedView
                style={[
                  styles.statusDot,
                  { backgroundColor: r.status === "pending" ? "#FF9500" : colors.icon },
                ]}
              />
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity onPress={createReminder}>
          <ThemedText style={[styles.seeAll, { color: colors.tint }]}>
            Create reminder
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: "#FF3B30" + "40" }]}
        onPress={handleLogout}
      >
        <IconSymbol size={20} name="arrow.right.square" color="#FF3B30" />
        <ThemedText style={styles.logoutText}>Sign Out</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 12 },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  profileInfo: { gap: 2 },
  emptyText: { fontSize: 14, opacity: 0.5, fontStyle: "italic" },
  summaryItem: { fontSize: 14, opacity: 0.7, marginBottom: 8 },
  seeAll: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  reminderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: { color: "#FF3B30", fontWeight: "600", fontSize: 16 },
});
