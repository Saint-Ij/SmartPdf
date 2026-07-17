import { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getToken, onAuthChange } from "@/lib/storage";
import { setOnUnauthorized } from "@/lib/api";
import { clearAuth } from "@/lib/storage";

export const unstable_settings = {
  anchor: "(tabs)",
};

function useProtectedRoute(token: string | null, loaded: boolean) {
  const segments = useSegments();

  useEffect(() => {
    if (!loaded) return;

    const inAuthGroup = segments[0] === ("(auth)" as string);

    if (!token && !inAuthGroup) {
      router.replace("/(auth)/login" as any);
    } else if (token && inAuthGroup) {
      router.replace("/(tabs)" as any);
    }
  }, [token, loaded, segments]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getToken().then((t) => {
      setToken(t);
      setLoaded(true);
    });
    const unsub = onAuthChange((t) => setToken(t));
    setOnUnauthorized(async () => {
      await clearAuth();
      router.replace("/(auth)/login" as any);
    });
    return unsub;
  }, []);

  useProtectedRoute(token, loaded);

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reader/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="conversation/[id]" options={{ title: "Chat" }} />
        <Stack.Screen name="quiz/take/[id]" options={{ title: "Quiz", presentation: "modal" }} />
        <Stack.Screen name="flashcard/review/[id]" options={{ title: "Flashcards", presentation: "modal" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
