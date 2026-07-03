import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView, ActivityIndicator,
  Alert, Image, Pressable, Modal, ScrollView,
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
  getListConversationsQueryKey, useEditMessage,
  useToggleReaction, usePinMessage, useGetPinnedMessages,
  useLockConversation,
} from "@workspace/api-client-react";
import VoiceRecorder from "@/components/messaging/VoiceRecorder";
import VoicePlayer from "@/components/messaging/VoicePlayer";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

type MsgType = "text" | "image" | "document" | "location" | "voice" | "video";

type Msg = {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderName: string;
  type: MsgType;
  content: string;
  fileName: string | null;
  fileMime: string | null;
  latitude: number | null;
  longitude: number | null;
  replyToId: number | null;
  replyTo: { id: number; content: string; type: string; senderName: string } | null;
  pinnedAt: string | null;
  pinnedBy: number | null;
  editedAt: string | null;
  mentions: number[];
  voiceDuration: number | null;
  reactions: Record<string, number[]>;
  createdAt: string;
  readBy: { userId: number; userName: string; readAt: string }[];
};

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "🙏", "✅"];

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

// ── READ RECEIPT ──

function ReadReceipt({ msg, myId, memberCount, onTap }: { msg: Msg; myId: number; memberCount: number; onTap: () => void }) {
  if (msg.senderId !== myId) return null;
  const readCount = msg.readBy.filter(r => r.userId !== myId).length;
  const totalOthers = memberCount - 1;
  const allRead = readCount >= totalOthers && totalOthers > 0;
  const delivered = readCount > 0;
  return (
    <TouchableOpacity onPress={onTap} style={styles.receipt}>
      <Text style={allRead ? styles.receiptBlue : styles.receiptGray}>{delivered || allRead ? "✓✓" : "✓"}</Text>
    </TouchableOpacity>
  );
}

// ── REACTIONS ROW ──

function ReactionsRow({ reactions, myId, onReact, isMe, colors }: {
  reactions: Record<string, number[]>; myId: number; onReact: (emoji: string) => void; isMe: boolean; colors: any;
}) {
  const entries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  if (!entries.length) return null;
  return (
    <View style={[styles.reactionsRow, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
      {entries.map(([emoji, users]) => (
        <TouchableOpacity
          key={emoji}
          onPress={() => onReact(emoji)}
          style={[styles.reactionChip, { backgroundColor: users.includes(myId) ? colors.primary + "25" : colors.card, borderColor: users.includes(myId) ? colors.primary : colors.border }]}
        >
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          <Text style={[styles.reactionCount, { color: colors.foreground }]}>{users.length}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── REPLY PREVIEW ──

function ReplyPreview({ replyTo, isMe, colors }: { replyTo: Msg["replyTo"]; isMe: boolean; colors: any }) {
  if (!replyTo) return null;
  const borderColor = isMe ? "rgba(255,255,255,0.5)" : colors.primary;
  const textColor = isMe ? "rgba(255,255,255,0.85)" : colors.mutedForeground;
  return (
    <View style={[styles.replyPreview, { borderLeftColor: borderColor }]}>
      <Text style={[styles.replyName, { color: borderColor }]} numberOfLines={1}>{replyTo.senderName}</Text>
      <Text style={[styles.replyContent, { color: textColor }]} numberOfLines={1}>
        {replyTo.type === "voice" ? "🎤 Voice note" : replyTo.type === "image" ? "📷 Photo" : replyTo.type === "document" ? "📎 Document" : replyTo.content}
      </Text>
    </View>
  );
}

// ── MESSAGE BUBBLE ──

function MessageBubble({
  msg, isMe, showName, memberCount, myId, colors, role,
  onLongPress, onReact, onReply, onReadReceiptTap,
}: {
  msg: Msg; isMe: boolean; showName: boolean; memberCount: number; myId: number;
  colors: any; role: string;
  onLongPress: () => void; onReact: (emoji: string) => void;
  onReply: () => void; onReadReceiptTap: () => void;
}) {
  const bgColor = isMe ? colors.primary : colors.card;
  const textColor = isMe ? "#FFF" : colors.foreground;
  const subColor = isMe ? "rgba(255,255,255,0.7)" : colors.mutedForeground;
  const isPinned = !!msg.pinnedAt;

  return (
    <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
      {isPinned && (
        <Text style={[styles.pinnedTag, { color: colors.primary }]}>📌 Pinned</Text>
      )}
      {showName && !isMe && (
        <Text style={[styles.senderName, { color: colors.primary }]}>{msg.senderName}</Text>
      )}
      {msg.replyTo && <ReplyPreview replyTo={msg.replyTo} isMe={isMe} colors={colors} />}
      <Pressable onLongPress={onLongPress} onPress={onReply} delayLongPress={350}>
        <View style={[styles.bubbleBg, { backgroundColor: bgColor },
          isMe ? { borderTopRightRadius: 4 } : { borderTopLeftRadius: 4 }]}>
          {msg.type === "image" && msg.content.startsWith("data:") && (
            <Image source={{ uri: msg.content }} style={styles.msgImage} resizeMode="cover" />
          )}
          {msg.type === "document" && (
            <View style={styles.docBox}>
              <Feather name="file" size={20} color={textColor} />
              <Text style={[styles.docName, { color: textColor }]} numberOfLines={1}>{msg.fileName ?? "Document"}</Text>
            </View>
          )}
          {msg.type === "voice" && (
            <VoicePlayer uri={msg.content} durationMs={msg.voiceDuration ?? 0} isMe={isMe} colors={colors} />
          )}
          {msg.type === "location" && (
            <View style={styles.locBox}>
              <Feather name="map-pin" size={16} color={textColor} />
              <Text style={[styles.locText, { color: textColor }]}>{msg.latitude?.toFixed(5)}, {msg.longitude?.toFixed(5)}</Text>
            </View>
          )}
          {(msg.type === "text" || msg.type === "video") && (
            <Text style={[styles.bubbleText, { color: textColor }]}>{msg.content}</Text>
          )}
          <View style={styles.bubbleMeta}>
            {msg.editedAt && <Text style={[styles.editedTag, { color: subColor }]}>edited</Text>}
            <Text style={[styles.bubbleTime, { color: subColor }]}>{formatTime(msg.createdAt)}</Text>
            {isMe && <ReadReceipt msg={msg} myId={myId} memberCount={memberCount} onTap={onReadReceiptTap} />}
          </View>
        </View>
      </Pressable>
      <ReactionsRow reactions={msg.reactions} myId={myId} onReact={onReact} isMe={isMe} colors={colors} />
    </View>
  );
}

// ── MENTION AUTOCOMPLETE ──

function MentionSuggestions({ members, query, onSelect, colors }: {
  members: { userId: number; name: string }[]; query: string; onSelect: (m: { userId: number; name: string }) => void; colors: any;
}) {
  const filtered = members.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
  if (!filtered.length) return null;
  return (
    <View style={[styles.mentionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {filtered.map(m => (
        <TouchableOpacity key={m.userId} onPress={() => onSelect(m)} style={styles.mentionRow}>
          <View style={[styles.mentionAvatar, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.mentionInitial, { color: colors.primary }]}>{m.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={[styles.mentionName, { color: colors.foreground }]}>{m.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── MAIN SCREEN ──

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = parseInt(id, 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const myId = user?.id ?? 0;
  const role = (user as any)?.role ?? "worker";
  const isAdmin = role === "admin" || role === "project_manager";

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showEmoji, setShowEmoji] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [editText, setEditText] = useState("");
  const [showReadModal, setShowReadModal] = useState<Msg | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [showOpts, setShowOpts] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<number[]>([]);

  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = insets.bottom;

  const { data: convos } = useListConversations({ query: { queryKey: getListConversationsQueryKey(), staleTime: 60000 } });
  const convo = (convos as any[] | undefined)?.find((c: any) => c.id === convId);
  const memberCount = convo?.members?.length ?? 2;
  const members: { userId: number; name: string }[] = convo?.members ?? [];

  const { data: messages, refetch } = useListMessages(convId, undefined, {
    query: { queryKey: getListMessagesQueryKey(convId), refetchInterval: 4000 },
  });
  const { data: pinnedMsgs } = useGetPinnedMessages(convId, { query: { queryKey: ["getPinnedMessages", convId], staleTime: 30000, enabled: showPinned } });

  const sendMsg = useSendMessage();
  const deleteMsg = useDeleteMessage();
  const editMsg = useEditMessage();
  const toggleReaction = useToggleReaction();
  const pinMsg = usePinMessage();
  const lockConv = useLockConversation();

  const { isOnline, queueLength, enqueue } = useOfflineQueue(() => {
    qc.invalidateQueries({ queryKey: getListMessagesQueryKey(convId) });
  });

  const msgs = useMemo(() => (messages ?? []) as Msg[], [messages]);

  const convoName = useMemo(() => {
    if (!convo) return "Chat";
    if (convo.type === "direct") return convo.members?.find((m: any) => m.userId !== myId)?.name ?? "Direct Message";
    return convo.name ?? (convo.type === "job_chat" ? "Job Chat" : "Team Chat");
  }, [convo, myId]);

  useEffect(() => {
    if (msgs.length) setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  }, [msgs.length]);

  // @mention detection
  const handleTextChange = (val: string) => {
    setText(val);
    const match = val.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (member: { userId: number; name: string }) => {
    const newText = text.replace(/@\w*$/, `@${member.name} `);
    setText(newText);
    setMentions(prev => [...new Set([...prev, member.userId])]);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListMessagesQueryKey(convId) });
    qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  }, [qc, convId]);

  const send = useCallback(async (opts?: {
    type?: string; content?: string; fileName?: string; fileMime?: string;
    voiceDuration?: number;
  }) => {
    const msgText = opts?.content ?? text.trim();
    if (!msgText && opts?.type !== "voice") return;

    if (editingMsg) {
      try {
        await editMsg.mutateAsync({ convId, msgId: editingMsg.id, data: { content: msgText } });
        invalidate();
        setEditingMsg(null); setEditText("");
      } catch (e: any) { Alert.alert("Error", e.message ?? "Failed to edit"); }
      return;
    }

    const payload: any = {
      type: opts?.type ?? "text", content: msgText,
      fileName: opts?.fileName, fileMime: opts?.fileMime,
      replyToId: replyTo?.id, mentions,
      voiceDuration: opts?.voiceDuration,
    };

    setSending(true);
    setReplyTo(null); setMentions([]);
    setText("");

    try {
      if (!isOnline) {
        await enqueue(convId, payload);
        return;
      }
      await sendMsg.mutateAsync({ id: convId, data: payload });
      invalidate();
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      await enqueue(convId, payload);
    } finally {
      setSending(false);
    }
  }, [text, editingMsg, replyTo, mentions, isOnline, convId]);

  const onVoiceRecorded = useCallback(async (uri: string, durationMs: number) => {
    setShowVoice(false);
    const base64 = await (ExpoFS as any).readAsStringAsync(uri, { encoding: "base64" });
    await send({ type: "voice", content: `data:audio/m4a;base64,${base64}`, fileMime: "audio/m4a", voiceDuration: durationMs });
  }, [send]);

  const pickImage = async () => {
    setShowAttach(false);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mime = asset.mimeType ?? "image/jpeg";
      await send({ type: "image", content: `data:${mime};base64,${asset.base64}`, fileName: asset.fileName ?? "photo.jpg", fileMime: mime });
    }
  };

  const pickDocument = async () => {
    setShowAttach(false);
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64 = await (ExpoFS as any).readAsStringAsync(asset.uri, { encoding: "base64" });
      await send({ type: "document", content: `data:${asset.mimeType ?? "application/octet-stream"};base64,${base64}`, fileName: asset.name, fileMime: asset.mimeType ?? "application/octet-stream" });
    }
  };

  const onLongPress = (msg: Msg) => {
    setShowEmoji(null);
    const actions: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
      { text: "Cancel", style: "cancel" },
      { text: "Reply", onPress: () => setReplyTo(msg) },
      { text: "React 😊", onPress: () => setShowEmoji(msg.id) },
    ];
    const canEdit = isAdmin || (msg.senderId === myId && Date.now() - new Date(msg.createdAt).getTime() < 10 * 60 * 1000);
    if (canEdit && msg.type === "text") {
      actions.push({ text: "Edit", onPress: () => { setEditingMsg(msg); setEditText(msg.content); } });
    }
    if (isAdmin) {
      actions.push({ text: msg.pinnedAt ? "Unpin" : "Pin 📌", onPress: () => pinMsg.mutateAsync({ convId, msgId: msg.id }).then(invalidate) });
    }
    const canDelete = isAdmin || msg.senderId === myId;
    if (canDelete) {
      actions.push({ text: "Delete", style: "destructive", onPress: async () => {
        await deleteMsg.mutateAsync({ convId, msgId: msg.id });
        invalidate();
      }});
    }
    Alert.alert("Message", undefined, actions);
  };

  const handleReact = useCallback(async (msgId: number, emoji: string) => {
    setShowEmoji(null);
    try {
      await toggleReaction.mutateAsync({ convId, msgId, data: { emoji } });
      invalidate();
    } catch {}
  }, [convId, invalidate]);

  let lastDateLabel = "";

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const isMe = item.senderId === myId;
    const prev = index > 0 ? msgs[index - 1] : null;
    const showName = !isMe && convo?.type !== "direct" && prev?.senderId !== item.senderId;
    const dateLabel = formatDate(item.createdAt);
    const showDate = dateLabel !== lastDateLabel;
    if (showDate) lastDateLabel = dateLabel;

    return (
      <View>
        {showDate && (
          <View style={styles.dateRow}>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateLabel, { color: colors.mutedForeground, backgroundColor: colors.background }]}>{dateLabel}</Text>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <MessageBubble
          msg={item} isMe={isMe} showName={showName} memberCount={memberCount}
          myId={myId} colors={colors} role={role}
          onLongPress={() => onLongPress(item)}
          onReply={() => setReplyTo(item)}
          onReact={emoji => handleReact(item.id, emoji)}
          onReadReceiptTap={() => setShowReadModal(item)}
        />
        {showEmoji === item.id && (
          <View style={[styles.emojiPicker, isMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {EMOJI_LIST.map(e => (
              <TouchableOpacity key={e} onPress={() => handleReact(item.id, e)} style={styles.emojiBtn}>
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowEmoji(null)} style={styles.emojiClose}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={topPad}
    >
      {/* HEADER */}
      <View style={[styles.chatHeader, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary + "20" }]}>
          <Feather name={convo?.type === "direct" ? "user" : convo?.type === "job_chat" ? "briefcase" : "users"} size={16} color={colors.primary} />
        </View>
        <View style={styles.headerInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{convoName}</Text>
            {convo?.isLocked && <Feather name="lock" size={12} color={colors.mutedForeground} />}
          </View>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{memberCount} {memberCount === 1 ? "member" : "members"}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/messages/search?convId=${convId}` as any)} style={styles.headerBtn}>
          <Feather name="search" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowPinned(true)} style={styles.headerBtn}>
          <Feather name="bookmark" size={20} color={colors.foreground} />
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity onPress={() => setShowOpts(true)} style={styles.headerBtn}>
            <Feather name="more-vertical" size={20} color={colors.foreground} />
          </TouchableOpacity>
        )}
      </View>

      {/* OFFLINE BANNER */}
      {(!isOnline || queueLength > 0) && (
        <View style={[styles.offlineBanner, { backgroundColor: !isOnline ? "#EF4444" : "#F59E0B" }]}>
          <Feather name={isOnline ? "clock" : "wifi-off"} size={14} color="#FFF" />
          <Text style={styles.offlineText}>
            {!isOnline ? "No connection — messages will send when online" : `${queueLength} message${queueLength > 1 ? "s" : ""} queued`}
          </Text>
        </View>
      )}

      {/* REPLY BAR */}
      {replyTo && !editingMsg && (
        <View style={[styles.replyBar, { backgroundColor: colors.card, borderTopColor: colors.border, borderLeftColor: colors.primary }]}>
          <View style={styles.replyBarContent}>
            <Text style={[styles.replyBarName, { color: colors.primary }]}>↩ {replyTo.senderName}</Text>
            <Text style={[styles.replyBarContent2, { color: colors.mutedForeground }]} numberOfLines={1}>
              {replyTo.type === "voice" ? "🎤 Voice note" : replyTo.type === "image" ? "📷 Photo" : replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* EDIT BAR */}
      {editingMsg && (
        <View style={[styles.replyBar, { backgroundColor: "#F59E0B20", borderTopColor: "#F59E0B", borderLeftColor: "#F59E0B" }]}>
          <View style={styles.replyBarContent}>
            <Text style={[styles.replyBarName, { color: "#F59E0B" }]}>✏️ Editing message</Text>
            <Text style={[styles.replyBarContent2, { color: colors.mutedForeground }]} numberOfLines={1}>{editingMsg.content}</Text>
          </View>
          <TouchableOpacity onPress={() => { setEditingMsg(null); setEditText(""); }}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* MENTION SUGGESTIONS */}
      {mentionQuery !== null && (
        <MentionSuggestions members={members.filter(m => m.userId !== myId)} query={mentionQuery} onSelect={insertMention} colors={colors} />
      )}

      {/* MESSAGES */}
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

      {/* VOICE RECORDER */}
      {showVoice ? (
        <VoiceRecorder onRecorded={onVoiceRecorded} onCancel={() => setShowVoice(false)} colors={colors} />
      ) : (
        /* INPUT BAR */
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: botPad + 8 }]}>
          <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.attachBtn}>
            <Feather name="paperclip" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            value={editingMsg ? editText : text}
            onChangeText={editingMsg ? setEditText : handleTextChange}
            placeholder={convo?.isLocked ? "Conversation locked" : "Message..."}
            placeholderTextColor={colors.mutedForeground}
            multiline
            editable={!convo?.isLocked}
            style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
          />
          {!(editingMsg ? editText : text).trim() && !convo?.isLocked && (
            <TouchableOpacity onPress={() => setShowVoice(true)} style={[styles.voiceBtn, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="mic" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => editingMsg ? send({ type: "text", content: editText }) : send()}
            disabled={!(editingMsg ? editText : text).trim() || sending || !!convo?.isLocked}
            style={[styles.sendBtn, { backgroundColor: (editingMsg ? editText : text).trim() && !convo?.isLocked ? colors.primary : colors.muted }]}
          >
            {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="send" size={16} color="#FFF" />}
          </TouchableOpacity>
        </View>
      )}

      {/* ATTACH MODAL */}
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

      {/* READ RECEIPT MODAL */}
      <Modal transparent animationType="slide" visible={!!showReadModal} onRequestClose={() => setShowReadModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowReadModal(null)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Read by</Text>
            {showReadModal?.readBy.filter(r => r.userId !== myId).length === 0 ? (
              <Text style={[styles.modalEmpty, { color: colors.mutedForeground }]}>Not read by anyone yet</Text>
            ) : (
              showReadModal?.readBy.filter(r => r.userId !== myId).map(r => (
                <View key={r.userId} style={styles.readRow}>
                  <View style={[styles.readAvatar, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.readInitial, { color: colors.primary }]}>{(r.userName?.[0] ?? "?").toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={[styles.readName, { color: colors.foreground }]}>{r.userName}</Text>
                    <Text style={[styles.readTime, { color: colors.mutedForeground }]}>{new Date(r.readAt).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </Pressable>
      </Modal>

      {/* PINNED MESSAGES MODAL */}
      <Modal transparent animationType="slide" visible={showPinned} onRequestClose={() => setShowPinned(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPinned(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>📌 Pinned Messages</Text>
            {!pinnedMsgs?.length ? (
              <Text style={[styles.modalEmpty, { color: colors.mutedForeground }]}>No pinned messages</Text>
            ) : (
              (pinnedMsgs as Msg[]).map(m => (
                <View key={m.id} style={[styles.pinnedItem, { borderColor: colors.border }]}>
                  <Text style={[styles.pinnedSender, { color: colors.primary }]}>{m.senderName}</Text>
                  <Text style={[styles.pinnedContent, { color: colors.foreground }]} numberOfLines={2}>{m.content}</Text>
                  <Text style={[styles.pinnedTime, { color: colors.mutedForeground }]}>{formatTime(m.createdAt)}</Text>
                </View>
              ))
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ADMIN OPTIONS MODAL */}
      {isAdmin && (
        <Modal transparent animationType="fade" visible={showOpts} onRequestClose={() => setShowOpts(false)}>
          <Pressable style={styles.attachOverlay} onPress={() => setShowOpts(false)}>
            <View style={[styles.optsMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity onPress={async () => {
                setShowOpts(false);
                await lockConv.mutateAsync({ id: convId });
                qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
              }} style={styles.optsRow}>
                <Feather name={convo?.isLocked ? "unlock" : "lock"} size={18} color={colors.foreground} />
                <Text style={[styles.optsLabel, { color: colors.foreground }]}>{convo?.isLocked ? "Unlock conversation" : "Lock conversation"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowOpts(false); router.push("/messages/emergency" as any); }} style={styles.optsRow}>
                <Feather name="alert-triangle" size={18} color="#EF4444" />
                <Text style={[styles.optsLabel, { color: "#EF4444" }]}>Emergency broadcast</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowOpts(false); router.push("/announcements" as any); }} style={styles.optsRow}>
                <Feather name="bell" size={18} color={colors.foreground} />
                <Text style={[styles.optsLabel, { color: colors.foreground }]}>Announcements</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { padding: 4 },
  headerBtn: { padding: 6 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  offlineBanner: { flexDirection: "row", alignItems: "center", padding: 8, paddingHorizontal: 14, gap: 6 },
  offlineText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_500Medium" },
  replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderLeftWidth: 3, gap: 8 },
  replyBarContent: { flex: 1 },
  replyBarName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  replyBarContent2: { fontSize: 12, fontFamily: "Inter_400Regular" },
  mentionBox: { borderTopWidth: 1, maxHeight: 140, paddingVertical: 4 },
  mentionRow: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  mentionAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  mentionInitial: { fontSize: 13, fontFamily: "Inter_700Bold" },
  mentionName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  msgList: { padding: 12 },
  dateRow: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 12, fontFamily: "Inter_500Medium", paddingHorizontal: 4 },
  bubbleWrap: { marginVertical: 2, maxWidth: "80%" },
  bubbleWrapMe: { alignSelf: "flex-end" },
  bubbleWrapThem: { alignSelf: "flex-start" },
  pinnedTag: { fontSize: 10, fontFamily: "Inter_500Medium", marginBottom: 2 },
  senderName: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 2, marginLeft: 12 },
  replyPreview: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6, paddingVertical: 2 },
  replyName: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  replyContent: { fontSize: 11, fontFamily: "Inter_400Regular" },
  bubbleBg: { padding: 10, paddingHorizontal: 12, borderRadius: 18 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  editedTag: { fontSize: 10, fontStyle: "italic" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 11 },
  receipt: {},
  receiptBlue: { fontSize: 12, color: "#3B82F6" },
  receiptGray: { fontSize: 12, color: "rgba(150,150,150,0.8)" },
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  reactionChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, borderWidth: 1, gap: 3 },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emojiPicker: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 24, borderWidth: 1, marginVertical: 4, gap: 4, alignSelf: "flex-start" },
  emojiBtn: { padding: 4 },
  emojiText: { fontSize: 22 },
  emojiClose: { padding: 4, marginLeft: 2 },
  msgImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  docBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  docName: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  locBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  locText: { fontSize: 13 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  attachBtn: { padding: 8 },
  voiceBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  textInput: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 100, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  attachOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000040", padding: 20 },
  attachMenu: { borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: "row", gap: 12 },
  attachOption: { flex: 1, alignItems: "center", gap: 6 },
  attachIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  attachLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalOverlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 12, maxHeight: "60%" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalEmpty: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 12 },
  readRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  readAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  readInitial: { fontSize: 15, fontFamily: "Inter_700Bold" },
  readName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  readTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pinnedItem: { borderBottomWidth: 1, paddingBottom: 10, gap: 3 },
  pinnedSender: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinnedContent: { fontSize: 14, fontFamily: "Inter_400Regular" },
  pinnedTime: { fontSize: 11 },
  optsMenu: { borderRadius: 16, borderWidth: 1, padding: 8, gap: 2 },
  optsRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  optsLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyChatText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
