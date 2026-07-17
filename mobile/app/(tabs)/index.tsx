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
import * as DocumentPicker from "expo-document-picker";
import { documentDirectory, makeDirectoryAsync, copyAsync } from "expo-file-system/legacy";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import type { Document } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadDocs() {
    try {
      const data = await api.get<{ documents: Document[] }>("/documents");
      setDocuments(data.documents);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function deleteDocument(doc: Document) {
    Alert.alert("Delete Document", `Delete "${doc.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/documents/${doc.id}`);
            await loadDocs();
          } catch {
            Alert.alert("Error", "Could not delete document");
          }
        },
      },
    ]);
  }

  useFocusEffect(
    useCallback(() => {
      loadDocs();
    }, []),
  );

  async function pickAndUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      const file = result.assets[0];
      const localUri = file.uri;

      const formData = new FormData();
      formData.append("file", {
        uri: localUri,
        name: file.name,
        type: "application/pdf",
      } as unknown as Blob);

      const { document: uploaded } = await api.upload<{ document: Document }>("/documents/upload", formData);

      const pdfDir = documentDirectory + "pdfs/";
      await makeDirectoryAsync(pdfDir, { intermediates: true });
      await copyAsync({ from: localUri, to: pdfDir + uploaded.id + ".pdf" });

      await loadDocs();
      router.push(`/reader/${uploaded.id}` as any);
    } catch (e) {
      console.error("Upload error:", e);
      const msg = e instanceof Error ? e.message : "Could not upload the PDF. Please try again.";
      Alert.alert("Upload failed", msg);
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "ready": return { label: "Ready", color: "#34C759" };
      case "processing": return { label: "Processing", color: "#FF9500" };
      case "uploading": return { label: "Uploading", color: "#007AFF" };
      case "failed": return { label: "Failed", color: "#FF3B30" };
      default: return { label: status, color: colors.icon };
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
      <ThemedView style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <ThemedText type="title">Library</ThemedText>
        <ThemedText style={styles.count}>{documents.length} documents</ThemedText>
      </ThemedView>

      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDocs(); }} />
        }
        ListEmptyComponent={
          <ThemedView style={styles.empty}>
            <IconSymbol size={64} name="doc.text" color={colors.icon} />
            <ThemedText style={styles.emptyTitle}>No documents yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Tap the + button to upload your first PDF
            </ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.processingStatus);
          return (
            <TouchableOpacity
              style={[styles.card, { borderColor: colors.icon + "30" }]}
              onPress={() => router.push(`/reader/${item.id}` as any)}
              onLongPress={() => deleteDocument(item)}
            >
              <ThemedView style={styles.cardIcon}>
                <IconSymbol size={28} name="doc.text.fill" color={colors.tint} />
              </ThemedView>
              <ThemedView style={styles.cardInfo}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText style={styles.cardMeta}>
                  {formatSize(item.fileSize)} · {item.pageCount} pages
                </ThemedText>
              </ThemedView>
              <ThemedView style={[styles.badge, { backgroundColor: badge.color + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: badge.color }]}>
                  {badge.label}
                </ThemedText>
              </ThemedView>
            </TouchableOpacity>
          );
        }}
      />

      {uploading && (
        <ThemedView style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.uploadingText}>Uploading and processing...</ThemedText>
        </ThemedView>
      )}

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.tint, bottom: insets.bottom + 24 }]}
          onPress={pickAndUpload}
        >
        <IconSymbol size={28} name="plus" color="#fff" />
      </TouchableOpacity>
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  emptySubtitle: { fontSize: 14, opacity: 0.6, textAlign: "center", paddingHorizontal: 40 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    gap: 12,
  },
  uploadingText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
