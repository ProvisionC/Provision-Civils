import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Alert, ActivityIndicator, Dimensions, Modal, Platform,
  StatusBar, SafeAreaView, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { downloadAsync, cacheDirectory, writeAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { isAvailableAsync as isSharingAvailable, shareAsync } from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListJobPhotos, useAddJobPhoto, useDeleteJobPhoto,
  useListDailyReports,
  getListJobPhotosQueryKey, getListDailyReportsQueryKey,
  getBaseUrl,
} from "@workspace/api-client-react";

const { width: SW } = Dimensions.get("window");
const COLS = 3;
const GAP = 3;
const PHOTO_SIZE = (SW - GAP * (COLS + 1)) / COLS;

type Filter = "all" | "job" | "report";
type Sort = "newest" | "oldest";

interface CombinedPhoto {
  key: string;
  uri: string;
  source: "job" | "report";
  sourceLabel: string;
  date: Date;
  jobPhotoId?: number;
}

export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [pendingAssets, setPendingAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<CombinedPhoto | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: jobPhotos, isLoading: loadingJob } = useListJobPhotos(jobId, {
    query: { queryKey: getListJobPhotosQueryKey(jobId) },
  });
  const { data: reports, isLoading: loadingReports } = useListDailyReports(jobId, {
    query: { queryKey: getListDailyReportsQueryKey(jobId) },
  });

  const isLoading = loadingJob || loadingReports;

  const combined = useMemo<CombinedPhoto[]>(() => {
    const list: CombinedPhoto[] = [];
    (jobPhotos ?? []).forEach(p => {
      list.push({
        key: `job-${p.id}`,
        uri: p.uri,
        source: "job",
        sourceLabel: "Job Photo",
        date: new Date(p.createdAt),
        jobPhotoId: p.id,
      });
    });
    (reports ?? []).forEach(r => {
      const rr = r as any;
      const uris: string[] = rr.photoUris ?? [];
      uris.forEach((uri, i) => {
        list.push({
          key: `report-${r.id}-${i}`,
          uri,
          source: "report",
          sourceLabel: `Report: ${r.date}`,
          date: new Date(r.createdAt),
        });
      });
    });
    return list;
  }, [jobPhotos, reports]);

  const displayed = useMemo(() => {
    let list = combined.filter(p => filter === "all" || p.source === filter);
    list = [...list].sort((a, b) =>
      sort === "newest" ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime()
    );
    return list;
  }, [combined, filter, sort]);

  const addPhoto = useAddJobPhoto({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListJobPhotosQueryKey(jobId) });
      },
      onError: () => Alert.alert("Upload Failed", "Could not save photo. Please try again."),
    },
  });

  const deletePhoto = useDeleteJobPhoto({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListJobPhotosQueryKey(jobId) });
        setViewerPhoto(null);
      },
    },
  });

  const pickFromGallery = useCallback(async () => {
    setSheetOpen(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Allow photo library access to add photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.9,
        base64: true,
        exif: false,
        selectionLimit: 10,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPendingAssets(prev => [...prev, ...result.assets].slice(0, 10));
      }
    } catch {
      Alert.alert("Error", "Could not open gallery.");
    }
  }, []);

  const takePhoto = useCallback(async () => {
    setSheetOpen(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Allow camera access to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        base64: true,
        exif: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPendingAssets(prev => [...prev, result.assets[0]].slice(0, 10));
      }
    } catch {
      Alert.alert("Error", "Could not open camera.");
    }
  }, []);

  const uploadAll = useCallback(async () => {
    if (pendingAssets.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: pendingAssets.length });

    for (let i = 0; i < pendingAssets.length; i++) {
      const asset = pendingAssets[i];
      if (!asset.base64) continue;
      const mime = asset.mimeType ?? "image/jpeg";
      const uri = `data:${mime};base64,${asset.base64}`;
      await new Promise<void>(resolve => {
        addPhoto.mutate(
          { id: jobId, data: { uri } },
          { onSettled: () => { setUploadProgress({ done: i + 1, total: pendingAssets.length }); resolve(); } }
        );
      });
    }

    setPendingAssets([]);
    setUploading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [pendingAssets, jobId, addPhoto]);

  const downloadPhoto = useCallback(async (photo: CombinedPhoto) => {
    if (isDownloading) return;
    setIsDownloading(true);
    const filename = `${photo.sourceLabel.replace(/[^a-zA-Z0-9-]/g, "_")}_${Date.now()}.jpg`;
    try {
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = photo.uri;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const fileUri = (cacheDirectory ?? "") + filename;
        const idx = photo.uri.indexOf(",");
        const b64 = idx >= 0 ? photo.uri.slice(idx + 1) : photo.uri;
        await writeAsStringAsync(fileUri, b64, {
          encoding: EncodingType.Base64,
        });
        const canShare = await isSharingAvailable();
        if (canShare) {
          await shareAsync(fileUri, { mimeType: "image/jpeg", dialogTitle: filename, UTI: "public.jpeg" });
        } else {
          Alert.alert("Saved", "Photo saved to device.");
        }
      }
    } catch (e) {
      Alert.alert("Download Failed", e instanceof Error ? e.message : "Could not download photo.");
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  const downloadAllZip = useCallback(async () => {
    if (isDownloading) return;
    if (combined.length === 0) { Alert.alert("No Photos", "There are no photos to download."); return; }
    setIsDownloading(true);
    const url = `${getBaseUrl()}/api/jobs/${jobId}/photos/zip`;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const filename = `Job-${jobId}-Photos.zip`;
    try {
      if (Platform.OS === "web") {
        const resp = await fetch(url, { headers });
        if (!resp.ok) throw new Error(`Server error ${resp.status}`);
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      } else {
        const fileUri = (cacheDirectory ?? "") + filename;
        const { status } = await downloadAsync(url, fileUri, { headers });
        if (status !== 200) throw new Error(`Download failed: HTTP ${status}`);
        const canShare = await isSharingAvailable();
        if (canShare) {
          await shareAsync(fileUri, { mimeType: "application/zip", dialogTitle: "All Photos" });
        } else {
          Alert.alert("Saved", "ZIP saved to device.");
        }
      }
    } catch (e) {
      Alert.alert("Download Failed", e instanceof Error ? e.message : "Could not download photos.");
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, combined.length, jobId, token]);

  const downloadPhotoReport = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const url = `${getBaseUrl()}/api/jobs/${jobId}/pdf/photos`;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const filename = `Job-${jobId}-PhotoReport.pdf`;
    try {
      if (Platform.OS === "web") {
        const resp = await fetch(url, { headers });
        if (!resp.ok) throw new Error(`Server error ${resp.status}`);
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      } else {
        const fileUri = (cacheDirectory ?? "") + filename;
        const { status } = await downloadAsync(url, fileUri, { headers });
        if (status !== 200) throw new Error(`Download failed: HTTP ${status}`);
        const canShare = await isSharingAvailable();
        if (canShare) {
          await shareAsync(fileUri, { mimeType: "application/pdf", dialogTitle: "Photo Report", UTI: "com.adobe.pdf" });
        } else {
          Alert.alert("Saved", "PDF saved to device.");
        }
      }
    } catch (e) {
      Alert.alert("Export Failed", e instanceof Error ? e.message : "Could not generate PDF.");
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, jobId, token]);

  const handleDeleteJobPhoto = useCallback((photoId: number) => {
    Alert.alert("Delete Photo", "Remove this photo from the job?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePhoto.mutate({ id: jobId, photoId }) },
    ]);
  }, [jobId, deletePhoto]);

  const handlePhotoPress = useCallback((photo: CombinedPhoto) => {
    setViewerPhoto(photo);
  }, []);

  const FILTER_OPTS: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${combined.length})` },
    { key: "job", label: `Job (${combined.filter(p => p.source === "job").length})` },
    { key: "report", label: `Reports (${combined.filter(p => p.source === "report").length})` },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.toolbarLeft}>
          {isDownloading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              {isAdmin && (
                <>
                  <TouchableOpacity
                    style={[styles.toolbarBtn, { borderColor: colors.border }]}
                    onPress={downloadAllZip}
                    disabled={combined.length === 0}
                  >
                    <Feather name="download" size={14} color={combined.length > 0 ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.toolbarBtnText, { color: combined.length > 0 ? colors.primary : colors.mutedForeground }]}>ZIP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toolbarBtn, { borderColor: colors.border }]}
                    onPress={downloadPhotoReport}
                    disabled={combined.length === 0}
                  >
                    <Feather name="file-text" size={14} color={combined.length > 0 ? "#FF6F00" : colors.mutedForeground} />
                    <Text style={[styles.toolbarBtnText, { color: combined.length > 0 ? "#FF6F00" : colors.mutedForeground }]}>PDF</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
        <TouchableOpacity
          style={[styles.toolbarBtn, { borderColor: colors.border }]}
          onPress={() => setSort(s => s === "newest" ? "oldest" : "newest")}
        >
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.toolbarBtnText, { color: colors.mutedForeground }]}>
            {sort === "newest" ? "Newest" : "Oldest"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setSheetOpen(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {FILTER_OPTS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.filterTab, filter === opt.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(opt.key)}
          >
            <Text style={[styles.filterTabText, { color: filter === opt.key ? colors.primary : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pending uploads panel */}
      {pendingAssets.length > 0 && (
        <View style={[styles.pendingPanel, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {pendingAssets.map((asset, i) => (
              <View key={i} style={styles.pendingThumb}>
                <Image source={{ uri: asset.uri }} style={styles.pendingImg} />
                {!uploading && (
                  <TouchableOpacity
                    style={styles.pendingRemove}
                    onPress={() => setPendingAssets(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <Feather name="x" size={10} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.pendingActions}>
            <Text style={[styles.pendingCount, { color: colors.primary }]}>
              {uploading
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                : `${pendingAssets.length} photo${pendingAssets.length !== 1 ? "s" : ""} selected`}
            </Text>
            <View style={styles.pendingBtns}>
              {!uploading && (
                <TouchableOpacity
                  style={styles.pendingCancel}
                  onPress={() => setPendingAssets([])}
                >
                  <Text style={[styles.pendingCancelText, { color: colors.mutedForeground }]}>Discard</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.pendingUploadBtn, { backgroundColor: colors.primary }, uploading && { opacity: 0.7 }]}
                onPress={uploadAll}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <><Feather name="upload" size={14} color="#FFF" /><Text style={styles.pendingUploadText}>Upload All</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Grid */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.center}>
          <Feather name="image" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {filter === "all" ? "No Photos Yet" : filter === "job" ? "No Job Photos" : "No Report Photos"}
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            {filter === "all" ? "Tap + to add photos to this job" : `No photos in this category`}
          </Text>
          {filter === "all" && (
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setSheetOpen(true)}
            >
              <Feather name="camera" size={16} color="#FFF" />
              <Text style={styles.emptyBtnText}>Add Photos</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.key}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handlePhotoPress(item)}
              style={[styles.thumb, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
            >
              <Image source={{ uri: item.uri }} style={styles.thumbImg} resizeMode="cover" />
              <View style={[styles.sourceLabel, { backgroundColor: item.source === "job" ? colors.primary + "CC" : "#FF6F00CC" }]}>
                <Text style={styles.sourceLabelText} numberOfLines={1}>
                  {item.source === "job" ? "Job" : item.sourceLabel.replace("Report: ", "")}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Action Sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSheetOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add Photos</Text>
          {Platform.OS !== "web" && (
            <TouchableOpacity style={[styles.sheetBtn, { borderBottomColor: colors.border }]} onPress={takePhoto}>
              <View style={[styles.sheetIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="camera" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetBtnLabel, { color: colors.foreground }]}>Take Photo</Text>
                <Text style={[styles.sheetBtnSub, { color: colors.mutedForeground }]}>Use camera to take one photo</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.sheetBtn, { borderBottomColor: colors.border }]} onPress={pickFromGallery}>
            <View style={[styles.sheetIcon, { backgroundColor: "#FF6F0020" }]}>
              <Feather name="image" size={20} color="#FF6F00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetBtnLabel, { color: colors.foreground }]}>Choose from Gallery</Text>
              <Text style={[styles.sheetBtnSub, { color: colors.mutedForeground }]}>Select multiple photos at once</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted }]} onPress={() => setSheetOpen(false)}>
            <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Full-screen Viewer */}
      <Modal visible={!!viewerPhoto} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => setViewerPhoto(null)}>
        <View style={styles.viewer}>
          <StatusBar hidden />
          {viewerPhoto && (
            <Image source={{ uri: viewerPhoto.uri }} style={styles.viewerImg} resizeMode="contain" />
          )}
          <SafeAreaView style={styles.viewerBar}>
            <TouchableOpacity style={styles.viewerBtn} onPress={() => setViewerPhoto(null)}>
              <Feather name="x" size={22} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              {viewerPhoto && (
                <Text style={styles.viewerLabel}>{viewerPhoto.sourceLabel}</Text>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={styles.viewerBtn}
                onPress={() => viewerPhoto && downloadPhoto(viewerPhoto)}
                disabled={isDownloading}
              >
                {isDownloading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Feather name="download" size={20} color="#FFF" />}
              </TouchableOpacity>
              {viewerPhoto?.source === "job" && viewerPhoto.jobPhotoId && (
                <TouchableOpacity
                  style={[styles.viewerBtn, { backgroundColor: "rgba(244,67,54,0.8)" }]}
                  onPress={() => viewerPhoto.jobPhotoId && handleDeleteJobPhoto(viewerPhoto.jobPhotoId)}
                >
                  <Feather name="trash-2" size={20} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  toolbarLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  toolbarBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  toolbarBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  filterRow: {
    flexDirection: "row", borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1, paddingVertical: 10, alignItems: "center",
  },
  filterTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pendingPanel: {
    padding: 12, borderBottomWidth: 1,
  },
  pendingThumb: { position: "relative", width: 60, height: 60 },
  pendingImg: { width: 60, height: 60, borderRadius: 8 },
  pendingRemove: {
    position: "absolute", top: -6, right: -6,
    backgroundColor: "#E53935", borderRadius: 10,
    width: 18, height: 18, alignItems: "center", justifyContent: "center",
  },
  pendingActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  pendingCount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pendingBtns: { flexDirection: "row", gap: 8 },
  pendingCancel: { paddingHorizontal: 12, paddingVertical: 6 },
  pendingCancelText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  pendingUploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  pendingUploadText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
  grid: { padding: GAP },
  thumb: { margin: GAP / 2, borderRadius: 6, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  sourceLabel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 4, paddingVertical: 3,
  },
  sourceLabelText: { color: "#FFF", fontSize: 9, fontFamily: "Inter_600SemiBold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 40, paddingHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  sheetBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  sheetIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sheetBtnLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sheetBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cancelBtn: { marginTop: 16, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  cancelText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerImg: { flex: 1 },
  viewerBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 44 : 12, gap: 10,
  },
  viewerBtn: { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, padding: 10 },
  viewerLabel: { color: "#FFF", fontSize: 12, fontFamily: "Inter_500Medium" },
});
