import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "smartpdf_auth_token";
const USER_KEY = "smartpdf_user";

type AuthListener = (token: string | null) => void;
const listeners = new Set<AuthListener>();

export function onAuthChange(fn: AuthListener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(token: string | null) {
  listeners.forEach((fn) => fn(token));
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  notify(token);
}

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  notify(null);
}

export async function saveUser(user: { id: string; email: string; name: string }) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<{ id: string; email: string; name: string } | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function removeUser() {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function clearAuth() {
  await removeToken();
  await removeUser();
}
