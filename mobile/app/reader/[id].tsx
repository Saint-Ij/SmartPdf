import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { documentDirectory, cacheDirectory, getInfoAsync, readAsStringAsync, writeAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import type { Document, Message, Section } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const CHAT_MAX_HEIGHT = SCREEN_HEIGHT * 0.5;

function buildPdfHtml(base64: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#525659;overflow-x:hidden}
#viewer{display:flex;flex-direction:column;align-items:center;padding:8px 0}
.page-container{margin:4px auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#fff;position:relative}
canvas{display:block}
.text-layer{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;opacity:0.2;color:transparent;pointer-events:none;-webkit-user-select:text;user-select:text}
</style>
</head>
<body>
<div id="viewer"></div>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
(async()=>{
  try{
    const b=atob("${base64}"),bytes=new Uint8Array(b.length);
    for(let i=0;i<b.length;i++)bytes[i]=b.charCodeAt(i);
    const pdf=await pdfjsLib.getDocument({data:bytes.buffer}).promise;
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const s=window.devicePixelRatio||1.5;
      const vp=page.getViewport({scale:s});
      const c=document.createElement('div');
      c.className='page-container';
      c.style.width=vp.width+'px';
      const ca=document.createElement('canvas');
      ca.width=vp.width;ca.height=vp.height;
      c.appendChild(ca);
      await page.render({canvasContext:ca.getContext('2d'),viewport:vp}).promise;
      const tc=await page.getTextContent();
      if(tc.items.length>0){
        const tl=document.createElement('div');
        tl.className='text-layer';
        for(const item of tc.items){
          if(!item.str)continue;
          const sp=document.createElement('span');
          sp.textContent=item.str;
          const tx=item.transform;
          sp.style.position='absolute';
          sp.style.left=(tx[4]*s)+'px';
          sp.style.top=(tx[5]*s)+'px';
          sp.style.fontSize=((item.height||12)*s)+'px';
          sp.style.fontFamily='sans-serif';
          sp.style.transform='scaleY(-1)';sp.style.transformOrigin='left top';
          sp.style.whiteSpace='pre';
          tl.appendChild(sp);
        }
        c.appendChild(tl);
      }
      document.getElementById('viewer').appendChild(c);
    }
  }catch(e){document.getElementById('viewer').innerHTML='<p style="color:#fff;padding:40px;text-align:center">Failed to render PDF</p>'}
})();
document.addEventListener('selectionchange',()=>{
  const s=window.getSelection(),t=s?s.toString().trim():'';
  if(t.length>3)window.ReactNativeWebView.postMessage(JSON.stringify({type:'textSelected',text:t}));
});
</script>
</body>
</html>`;
}

export default function ReaderScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [document, setDocument] = useState<Document | null>(null);
  const [pdfViewerUri, setPdfViewerUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    loadDocument();
  }, [id]);

  async function loadDocument() {
    try {
      const res = await api.get<{ document: Document }>(`/documents/${id}`);
      setDocument(res.document);

      const pdfPath = documentDirectory + "pdfs/" + id + ".pdf";
      const info = await getInfoAsync(pdfPath);
      if (info.exists) {
        const base64 = await readAsStringAsync(pdfPath, { encoding: EncodingType.Base64 });
        const html = buildPdfHtml(base64);
        const htmlPath = cacheDirectory + "pdf-viewer-" + id + ".html";
        await writeAsStringAsync(htmlPath, html, { encoding: EncodingType.UTF8 });
        setPdfViewerUri(htmlPath);
      } else {
        setLoadError(true);
      }

      const secs = await api.get<{ sections: Section[] }>(`/documents/${id}/sections`);
      setSections(secs.sections);
      if (secs.sections.length > 0) setSelectedSectionId(secs.sections[0]!.id);

      await loadConversationMessages();
    } catch {
      Alert.alert("Error", "Could not load document");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function ensureConversation(): Promise<string> {
    if (convId) return convId;
    const convRes = await api.get<{ conversations: Array<{ id: string; documentId: string }> }>("/conversations");
    let found = convRes.conversations.find((c) => c.documentId === id)?.id ?? null;
    if (!found) {
      const newConv = await api.post<{ conversation: { id: string } }>("/conversations", {
        documentId: id,
        title: document?.title || "Chat",
      });
      found = newConv.conversation.id;
    }
    setConvId(found);
    return found;
  }

  async function loadConversationMessages() {
    try {
      const cId = await ensureConversation();
      const chatRes = await api.get<{ messages: Message[] }>(`/conversations/${cId}/messages`);
      setMessages(chatRes.messages);
    } catch {
      // new conversation, no messages yet
    }
  }

  function handleWebViewMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "textSelected" && msg.text) {
        setSelectedText(msg.text);
      }
    } catch { /* ignore */ }
  }

  async function handleSend(explainText?: string) {
    const text = explainText || input;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      conversationId: convId || "",
      role: "user",
      content: text,
      sourceChunkIds: [],
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const cId = await ensureConversation();
      const chatRes = await api.post<{ message: Message }>(
        `/conversations/${cId}/chat`,
        { content: text },
      );

      setMessages((prev) => [...prev, chatRes.message]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          conversationId: convId || "",
          role: "assistant",
          content: "Sorry, I couldn't process your request. Please try again.",
          sourceChunkIds: [],
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleQuickAction(action: string) {
    switch (action) {
      case "explain":
        if (selectedText) {
          setChatOpen(true);
          await handleSend(`Explain this: ${selectedText}`);
        }
        break;
      case "summarize":
        setChatOpen(true);
        await handleSend("Summarize this document");
        break;
      case "quiz":
        try {
          if (sections.length > 1 && !selectedSectionId) {
            setShowSectionPicker(true);
            return;
          }
          const sectionTitle = sections.find((s) => s.id === selectedSectionId)?.title;
          await api.post("/quizzes/generate", { documentId: id, sectionId: selectedSectionId || undefined, totalQuestions: 5 });
          Alert.alert("Quiz Generated", sectionTitle ? `Quiz generated for "${sectionTitle}"` : "Check the Quizzes tab to take it!");
        } catch {
          Alert.alert("Error", "Could not generate quiz");
        }
        break;
      case "flashcards":
        try {
          if (sections.length > 1 && !selectedSectionId) {
            setShowSectionPicker(true);
            return;
          }
          const fcSectionTitle = sections.find((s) => s.id === selectedSectionId)?.title;
          await api.post("/flashcards/generate", { documentId: id, sectionId: selectedSectionId || undefined, count: 5 });
          Alert.alert("Flashcards Created", fcSectionTitle ? `Flashcards for "${fcSectionTitle}"` : "Check the Flashcards tab to review them!");
        } catch {
          Alert.alert("Error", "Could not generate flashcards");
        }
        break;
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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: "#525659" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ThemedView style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol size={24} name="chevron.left" color={colors.text} />
        </TouchableOpacity>
        <ThemedView style={styles.headerInfo}>
          <ThemedText numberOfLines={1} type="defaultSemiBold">
            {document?.title || "Document"}
          </ThemedText>
          {document && (
            <ThemedText style={styles.headerMeta}>{document.pageCount} pages</ThemedText>
          )}
        </ThemedView>
      </ThemedView>

      {sections.length > 1 && (
        <ThemedView style={[styles.sectionBar, { backgroundColor: colors.background, borderBottomColor: colors.icon + "20" }]}>
          <FlatList
            horizontal
            data={sections}
            keyExtractor={(s) => s.id}
            contentContainerStyle={styles.sectionList}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.sectionChip,
                  {
                    backgroundColor: item.id === selectedSectionId ? colors.tint + "20" : colors.icon + "10",
                    borderColor: item.id === selectedSectionId ? colors.tint : "transparent",
                  },
                ]}
                onPress={() => setSelectedSectionId(item.id)}
              >
                <ThemedText
                  style={[
                    styles.sectionChipText,
                    { color: item.id === selectedSectionId ? colors.tint : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </ThemedText>
              </TouchableOpacity>
            )}
          />
        </ThemedView>
      )}

      {loadError ? (
        <ThemedView style={styles.errorContainer}>
          <IconSymbol size={48} name="exclamationmark.triangle" color={colors.icon} />
          <ThemedText style={styles.errorTitle}>File Unavailable</ThemedText>
          <ThemedText style={styles.errorMessage}>
            This PDF is only available during the session in which it was uploaded.
            Please go back to the Library and re-upload the document.
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.pdfContainer}>
          {pdfViewerUri && (
            <WebView
              ref={webViewRef}
              source={{ uri: pdfViewerUri }}
              style={styles.webview}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              onMessage={handleWebViewMessage}
            />
          )}
        </View>
      )}

      {selectedText.length > 0 && (
        <TouchableOpacity
          style={[styles.explainFab, { backgroundColor: colors.tint }]}
          onPress={() => handleQuickAction("explain")}
        >
          <IconSymbol size={20} name="sparkle" color="#fff" />
          <ThemedText style={styles.explainFabText}>Explain</ThemedText>
        </TouchableOpacity>
      )}

      <ThemedView
        style={[
          styles.actions,
          { backgroundColor: colors.background, borderTopColor: colors.icon + "20" },
        ]}
      >
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: colors.tint + "15" }]}
          onPress={() => handleQuickAction("summarize")}
        >
          <IconSymbol size={14} name="text.alignleft" color={colors.tint} />
          <ThemedText style={[styles.chipText, { color: colors.tint }]}>Summarize</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: "#34C759" + "15" }]}
          onPress={() => handleQuickAction("quiz")}
        >
          <IconSymbol size={14} name="checkmark.circle" color="#34C759" />
          <ThemedText style={[styles.chipText, { color: "#34C759" }]}>Quiz me</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: "#FF9500" + "15" }]}
          onPress={() => handleQuickAction("flashcards")}
        >
          <IconSymbol size={14} name="rectangle.stack" color="#FF9500" />
          <ThemedText style={[styles.chipText, { color: "#FF9500" }]}>Cards</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: colors.icon + "15" }]}
          onPress={() => setChatOpen(!chatOpen)}
        >
          <IconSymbol size={14} name={chatOpen ? "chevron.down" : "chevron.up"} color={colors.icon} />
          <ThemedText style={[styles.chipText, { color: colors.icon }]}>
            {chatOpen ? "Close" : "Chat"}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {chatOpen && (
        <ThemedView style={[styles.chatPanel, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <ThemedView
                style={[
                  styles.messageBubble,
                  item.role === "user"
                    ? [styles.userBubble, { backgroundColor: colors.tint }]
                    : [styles.assistantBubble, { backgroundColor: colors.icon + "15" }],
                ]}
              >
                <ThemedText style={item.role === "user" ? { color: "#fff" } : {}}>
                  {item.content}
                </ThemedText>
              </ThemedView>
            )}
            ListEmptyComponent={
              <ThemedText style={styles.chatPlaceholder}>
                Ask a question about this document...
              </ThemedText>
            }
          />
          <ThemedView style={[styles.inputBar, { borderTopColor: colors.icon + "20" }]}>
            <TextInput
              style={[styles.chatInput, { color: colors.text, borderColor: colors.icon + "30" }]}
              placeholder="Ask anything..."
              placeholderTextColor={colors.icon}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.tint }]}
              onPress={() => handleSend()}
              disabled={sending || !input.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <IconSymbol size={18} name="arrow.up" color="#fff" />
              )}
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      )}

      {showSectionPicker && (
        <ThemedView style={[styles.sectionPickerOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <ThemedView style={[styles.sectionPickerCard, { backgroundColor: colors.background }]}>
            <ThemedText style={styles.sectionPickerTitle}>Choose a section</ThemedText>
            <FlatList
              data={sections}
              keyExtractor={(s) => s.id}
              style={styles.sectionPickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.sectionPickerItem, { borderBottomColor: colors.icon + "20" }]}
                  onPress={() => {
                    setSelectedSectionId(item.id);
                    setShowSectionPicker(false);
                  }}
                >
                  <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                  <ThemedText style={styles.sectionPickerMeta}>
                    Pages {item.startPage}–{item.endPage}
                  </ThemedText>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={[styles.sectionPickerCancel, { borderTopColor: colors.icon + "20" }]}
              onPress={() => setShowSectionPicker(false)}
            >
              <ThemedText style={styles.sectionPickerCancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  headerInfo: { flex: 1, marginLeft: 4 },
  headerMeta: { fontSize: 12, opacity: 0.6 },
  pdfContainer: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#525659" },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: "600" },
  errorMessage: { fontSize: 14, opacity: 0.6, textAlign: "center", lineHeight: 20 },
  explainFab: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    top: Platform.OS === "ios" ? 100 : 80,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  explainFabText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  chatPanel: { maxHeight: CHAT_MAX_HEIGHT, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)" },
  messageList: { maxHeight: CHAT_MAX_HEIGHT - 60 },
  messageContent: { padding: 12, gap: 8 },
  messageBubble: { padding: 12, borderRadius: 16, maxWidth: "85%" },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  chatPlaceholder: { textAlign: "center", opacity: 0.4, padding: 20 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", padding: 8, gap: 8, borderTopWidth: 1 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  sectionBar: {
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  sectionList: { paddingHorizontal: 12, gap: 8 },
  sectionChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionChipText: { fontSize: 13, fontWeight: "600" },
  sectionPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  sectionPickerCard: {
    width: "85%",
    maxHeight: "70%",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  sectionPickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    padding: 16,
    paddingBottom: 8,
  },
  sectionPickerList: { maxHeight: 300 },
  sectionPickerItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 2,
  },
  sectionPickerMeta: { fontSize: 12, opacity: 0.6 },
  sectionPickerCancel: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
  },
  sectionPickerCancelText: { fontSize: 16, opacity: 0.6, fontWeight: "600" },
});
