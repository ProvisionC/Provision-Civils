import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView, ActivityIndicator,
  Alert, Image, Pressable, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as ExpoFS from "expo-file-system";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListMessages, useSendMessage, useDeleteMessage,
  useListConversations, getListMessagesQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";

type Msg = {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderName: string;
  type: "text" | "image" | "document" | "location";
  content: string;
  fileName: string | null;
  fileMime: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  readBy: { userId: number; readAt: string }[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return "Today";
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function ReadReceipt({ msg, myId, memberCount }: { msg: Msg; myId: number; memberCount: number }) {
  if (msg.senderId !== myId) return null;
  const readCount = msg.readBy.filter(r => r.userId !== myId).length;
  const totalOthers = memberCount - 1;
  const allRead = readCount >= totalOthers && totalOthers > 0;
  const delivered = readCount > 0;
  return (
    <View style={styles.receipt}>
      {allRead ? (
        <Text style={styles.receiptBlue}>✓✓</Text>
      ) : delivered ? (
        <Text style={styles.receiptGray}>✓✓</Text>
      ) : (
        <Text style={styles.receiptGray}>✓</Text>
      )}
    </View>
  );
}

function MessageBubble({
  msg, isMe, showName, memberCount, onLongPress, colors,
}: {
  msg: Msg; isMe: boolean; showName: boolean; memberCount: number; onLongPress: () => void; colors: any;
}) {
  const bgColor = isMe ? colors.primary : colors.card;
  const textColor = isMe ? "#FFF" : colors.foreground;
  const subColor = isMe ? "rgba(255,255,255,0.7)" : colors.mutedForeground;

  return (
    <Pressable onLongPress={onLongPress} style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      {showName && !isMe && (
        <Text style={[styles.senderName, { color: colors.primary }]}>{msg.senderName}</Text>
      )}
      <View style={[styles.bubbleBg, { backgroundColor: bgColor, borderRadius: isMe ? 18 : 18 }, !isMe && { borderTopLeftRadius: 4 }, isMe && { borderTopRightRadius: 4 }]}>
        {msg.type === "image" && msg.content.startsWith("data:") && (
          <Image source={{ uri: msg.content }} style={styles.msgImage} resizeMode="cover" />
        )}
        {msg.type === "document" && (
          <View style={styles.docBox}>
            <Feather name="file" size={20} color={textColor} />
            <Text style={[styles.docName, { color: textColor }]} numberOfLines={1}>{msg.fileName ?? "Document"}</Text>
          </View>
        )}
        {msg.type === "location" && (
          <View style={styles.locBox}>
            <Feather name="map-pin" size={16} color={textColor} />
            <Text style={[styles.locText, { color: textColor }]}>
              {msg.latitude?.toFixed(5)}, {msg.longitude?.toFixed(5)}
            </Text>
          </View>
        )}
        {(msg.type === "text" || (msg.type !== "image" && msg.type !== "document" && msg.type !== "location")) && (
          <Text style={[styles.bubbleText, { color: textColor }]}>{msg.content}</Text>
        )}
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, { color: subColor }]}>{formatTime(msg.createdAt)}</Text>
          {isMe && <ReadReceipt msg={msg} myId={0} memberCount={memberCount} />}
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = parseInt(id, 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const myId = user?.id ?? 0;

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "ios" ? insets.bottom : 0;

  const { data: convos } = useListConversations({ query: { queryKey: getListConversationsQueryKey(), staleTime: 60000 } });
  const convo = (convos as any[] | undefined)?.find((c: any) => c.id === convId);
  const memberCount = convo?.members?.length ?? 2;

  const { data: messages, refetch } = useListMessages(convId, undefined, {
    query: { queryKey: getListMessagesQueryKey(convId), refetchInterval: 3000 },
  });

  const sendMsg = useSendMessage();
  const deleteMsg = useDeleteMessage();

  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages?.length]);

  const send = useCallback(async (opts?: { type?: string; content?: string; fileName?: string; fileMime?: string }) => {
    const msgText = opts?.content ?? text.trim();
    if (!msgText && opts?.type === "text") return;
    setSending(true);
    try {
      await sendMsg.mutateAsync({
        id: convId,
        data: {
          type: (opts?.type ?? "text") as any,
          content: msgText,
          fileName: opts?.fileName,
          fileMime: opts?.fileMime,
        },
      });
      setText("");
      qc.invalidateQueries({ queryKey: getListMessagesQueryKey(convId) });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }, [text, convId]);

  const pickImage = async () => {
    setShowAttach(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mime = asset.mimeType ?? "image/jpeg";
      const content = `data:${mime};base64,${asset.base64}`;
      await send({ type: "image", content, fileName: asset.fileName ?? "photo.jpg", fileMime: mime });
    }
  };

  const pickDocument = async () => {
    setShowAttach(false);
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64 = await (ExpoFS as any).readAsStringAsync(asset.uri, { encoding: "base64" });
      const content = `data:${asset.mimeType ?? "application/octet-stream"};base64,${base64}`;
      await send({ type: "document", content, fileName: asset.name, fileMime: asset.mimeType ?? "application/octet-stream" });
    }
  };

  const onLongPress = (msg: Msg) => {
    const actions: any[] = [{ text: "Cancel", style: "cancel" as const }];
    if (msg.senderId === myId) {
      actions.push({
        text: "Delete",
        style: "destructive" as const,
        onPress: async () => {
          await deleteMsg.mutateAsync({ convId, msgId: msg.id });
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey(convId) });
        },
      });
    }
    Alert.alert("Message", undefined, actions);
  };

  const msgs = (messages ?? []) as Msg[];
  const convoName = convo?.name ?? (convo?.type === "direct"
    ? convo?.members?.find((m: any) => m.userId !== myId)?.name ?? "Chat"
    : "Chat");

  let lastDateLabel = "";

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const isMe = item.senderId === myId;
    const prev = index > 0 ? msgs[index - 1] : null;
    const showName = !isMe && (convo?.type !== "direct") && (prev?.senderId !== item.senderId);
    const dateLabel = formatDate(item.createdAt);
    const showDate = dateLabel !== lastDateLabel;
    if (showDate) lastDateLabel = dateLabel;

    return (
      <>
        {showDate && (
          <View style={styles.dateRow}>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateLabel, { color: colors.mutedForeground, backgroundColor: colors.background }]}>{dateLabel}</Text>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <MessageBubble
          msg={item}
          isMe={isMe}
          showName={showName}
          memberCount={memberCount}
          onLongPress={() => onLongPress(item)}
          colors={colors}
        />
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.chatHeader, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary + "20" }]}>
          <Feather
            name={convo?.type === "direct" ? "user" : convo?.type === "job_chat" ? "briefcase" : "users"}
            size={16}
            color={colors.primary}
          />
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{convoName}</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </Text>
        </View>
      </View>

      <FlatList
        ref={flatRef}
        data={msgs}
        keyExtractor={m => String(m.id)}
        contentContainerStyle={[styles.msgList, { paddingBottom: 8 }]}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Feather name="message-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>No messages yet — say hello!</Text>
          </View>
        }
      />

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: botPad + 8 }]}>
        <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.attachBtn}>
          <Feather name="paperclip" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
        />
        <TouchableOpacity
          onPress={() => send()}
          disabled={!text.trim() || sending}
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
        >
          {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="send" size={16} color="#FFF" />}
        </TouchableOpacity>
      </View>

      <Modal transparent animationType="fade" visible={showAttach} onRequestClose={() => setShowAttach(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setShowAttach(false)}>
          <View style={[styles.attachMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity onPress={pickImage} style={styles.attachOption}>
              <View style={[styles.attachIcon, { backgroundColor: "#2563EB20" }]}>
                <Feather name="image" size={20} color="#2563EB" />
              </View>
              <Text style={[styles.attachLabel, { color: colors.foreground }]}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickDocument} style={styles.attachOption}>
              <View style={[styles.attachIcon, { backgroundColor: "#7C3AED20" }]}>
                <Feather name="file" size={20} color="#7C3AED" />
              </View>
              <Text style={[styles.attachLabel, { color: colors.foreground }]}>Document</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  msgList: { padding: 12 },
  dateRow: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 12, fontFamily: "Inter_500Medium", paddingHorizontal: 4 },
  bubble: { marginVertical: 2, maxWidth: "80%" },
  bubbleMe: { alignSelf: "flex-end" },
  bubbleThem: { alignSelf: "flex-start" },
  senderName: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 2, marginLeft: 12 },
  bubbleBg: { padding: 10, paddingHorizontal: 12 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  bubbleMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 11 },
  receipt: {},
  receiptBlue: { fontSize: 12, color: "#3B82F6" },
  receiptGray: { fontSize: 12, color: "rgba(150,150,150,0.8)" },
  msgImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  docBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  docName: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  locBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  locText: { fontSize: 13 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  attachBtn: { padding: 8 },
  textInput: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 100, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  attachOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000040", padding: 20 },
  attachMenu: { borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: "row", gap: 12 },
  attachOption: { flex: 1, alignItems: "center", gap: 6 },
  attachIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  attachLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyChatText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
