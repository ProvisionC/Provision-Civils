import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSearchMessages } from "@workspace/api-client-react";

type SearchResult = {
  id: number;
  conversationId: number;
  conversationName: string;
  conversationType: string;
  senderId: number | null;
  senderName: string;
  type: string;
  content: string;
  fileName: string | null;
  createdAt: string;
};

export default function MessageSearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { convId } = useLocalSearchParams<{ convId?: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [keyword, setKeyword] = useState("");
  const [submitted, setSubmitted] = useState("");

  const params = submitted ? {
    keyword: submitted || undefined,
    ...(convId ? {} : {}),
  } : undefined;

  const { data: results, isLoading } = useSearchMessages(params as any, {
    query: { queryKey: ["searchMessages", submitted], enabled: !!submitted, staleTime: 10000 },
  });

  const onSearch = () => setSubmitted(keyword.trim());

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "2-digit" });
  }

  function getTypeIcon(type: string) {
    if (type === "image") return "image";
    if (type === "document") return "file";
    if (type === "voice") return "mic";
    if (type === "location") return "map-pin";
    return "message-circle";
  }

  const renderItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      onPress={() => router.push(`/messages/${item.conversationId}` as any)}
      style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={[styles.typeIcon, { backgroundColor: colors.primary + "15" }]}>
        <Feather name={getTypeIcon(item.type) as any} size={16} color={colors.primary} />
      </View>
      <View style={styles.resultBody}>
        <View style={styles.resultMeta}>
          <Text style={[styles.resultConvo, { color: colors.primary }]} numberOfLines={1}>{item.conversationName}</Text>
          <Text style={[styles.resultDate, { color: colors.mutedForeground }]}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={[styles.resultSender, { color: colors.mutedForeground }]}>{item.senderName}</Text>
        <Text style={[styles.resultContent, { color: colors.foreground }]} numberOfLines={2}>
          {item.type === "voice" ? "🎤 Voice note" : item.type === "image" ? "📷 Photo" : item.type === "document" ? `📎 ${item.fileName ?? "Document"}` : item.content}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={onSearch}
            placeholder="Search messages..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            autoFocus
            returnKeyType="search"
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => { setKeyword(""); setSubmitted(""); }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={onSearch} style={[styles.searchBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {!isLoading && submitted && (!results || results.length === 0) && (
        <View style={styles.center}>
          <Feather name="search" size={40} color={colors.mutedForeground} />
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No messages found for "{submitted}"</Text>
        </View>
      )}

      {!submitted && (
        <View style={styles.center}>
          <Feather name="search" size={40} color={colors.mutedForeground} />
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>Search across all your conversations</Text>
        </View>
      )}

      <FlatList
        data={(results ?? []) as SearchResult[]}
        keyExtractor={r => String(r.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  back: { padding: 4 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  searchBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  searchBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  list: { padding: 12, gap: 8 },
  resultCard: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", gap: 12 },
  typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  resultBody: { flex: 1, gap: 3 },
  resultMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultConvo: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  resultDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  resultSender: { fontSize: 12, fontFamily: "Inter_500Medium" },
  resultContent: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  empty: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
});
