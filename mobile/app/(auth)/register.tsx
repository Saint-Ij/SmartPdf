import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, type Href } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api, ApiError } from "@/lib/api";
import { saveToken, saveUser } from "@/lib/storage";

interface RegisterResponse {
  user: { id: string; email: string; name: string };
  token: string;
}

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<RegisterResponse>("/auth/register", {
        name,
        email,
        password,
      });
      console.log("[Register] API success, saving token");
      await saveToken(data.token);
      console.log("[Register] Token saved, saving user");
      await saveUser(data.user);
      console.log("[Register] User saved, navigating to tabs");
      router.replace("/(tabs)" as Href);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Connection failed";
      console.error("[Register] Error:", e);
      Alert.alert("Registration failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Create Account</ThemedText>
        <ThemedText style={styles.subtitle}>Start your learning journey</ThemedText>
      </ThemedView>

      <ThemedView style={styles.form}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
          placeholder="Full name"
          placeholderTextColor={colors.icon}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
          placeholder="Email"
          placeholderTextColor={colors.icon}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
          placeholder="Password"
          placeholderTextColor={colors.icon}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Create Account</ThemedText>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={[styles.link, { color: colors.tint }]}>
            Already have an account? Sign in
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 48 },
  subtitle: { marginTop: 8, opacity: 0.7 },
  form: { gap: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { textAlign: "center", marginTop: 8 },
});
