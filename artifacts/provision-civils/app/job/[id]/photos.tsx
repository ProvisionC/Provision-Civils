import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Alert, ActivityIndicator, Dimensions, Modal, Platform,
  StatusBar, SafeAreaView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { cacheDirectory, writeAsStringAsync, EncodingType, downloadAsync } from "expo-file-system/legacy";
import { isAvailableAsync as isSharingAvailable, shareAsync } from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListJobPhotos, useAddJobPhoto, useDeleteJobPhoto,
  getListJobPhotosQueryKey,
  getBaseUrl,
} from "@workspace/api-client-react";

const { width: SW } = Dimensions.get("window");
const COLS = 3;
const GAP = 3;
const PHOTO_SIZE = (SW - GAP * (COLS + 1)) / COLS;

type PhotoCategory = "before" | "during" | "after" | "other";

const CATEGORIES: { key: PhotoCategory; label: string; emoji: string; color: string }[] = [
  { key: "before", label: "Before",  emoji: "📁", color: "#1E88E5" },
  { key: "during", label: "During",  emoji: "📁", color: "#FB8C00" },
  { key: "after",  label: "After",   emoji: "📁", color: "#43A047" },
  { key: "other",  label: "Other",   emoji: "📁", color: "#8E24AA" },
];

interface PhotoItem {
  id: number;
  jobId: number;
  uri: string;
  caption: string | null;
  category: PhotoCategory;
  createdAt: string;
}

export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";

  const [openFolder, setOpenFolder] = useState<PhotoCategory | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<PhotoItem | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, failed: 0 });
  const uploadCategoryRef = useRef<PhotoCategory>("other");

  const { data: allPhotos = [], isLoading } = useListJobPhotos(jobId, undefined, {
    query: { queryKey: getListJobPhotosQueryKey(jobId) },
  });

  const photosByCategory = useMemo(() => {
    const map: Record<PhotoCategory, PhotoItem[]> = {
      before: [], during: [], after: [], other: [],
    };
    for (const p of allPhotos as PhotoItem[]) {
      const cat: PhotoCategory = (p.category as PhotoCategory) ?? "other";
      if (map[cat]) map[cat].push(p);
      else map.other.push(p);
    }
    return map;
  }, [allPhotos]);

  const folderPhotos = openFolder ? photosByCategory[openFolder] : [];

  const addPhoto = useAddJobPhoto({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListJobPhotosQueryKey(jobId) });
      },
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

  const startCategoryPicker = useCallback(() => {
    setCategoryPickerOpen(true);
  }, []);

  const pickFromGallery = useCallback(async (category: PhotoCategory) => {
    setCategoryPickerOpen(false);
    uploadCategoryRef.current = category;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Allow photo library access to add photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        base64: true,
        exif: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      await uploadAssets(result.assets, category);
    } catch {
      Alert.alert("Error", "Could not open gallery.");
    }
  }, []);

  const takePhoto = useCallback(async (category: PhotoCategory) => {
    setCategoryPickerOpen(false);
    uploadCategoryRef.current = category;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Allow camera access to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        base64: true,
        exif: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      await uploadAssets(result.assets, category);
    } catch {
      Alert.alert("Error", "Could not open camera.");
    }
  }, []);

  const uploadAssets = useCallback(async (
    assets: ImagePicker.ImagePickerAsset[],
    category: PhotoCategory,
  ) => {
    setUploading(true);
    setUploadProgress({ done: 0, total: assets.length, failed: 0 });
    if (openFolder !== category) setOpenFolder(category);

    let failed = 0;
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      if (!asset.base64) {
        failed++;
        setUploadProgress({ done: i + 1, total: assets.length, failed });
        continue;
      }
      const mime = asset.mimeType ?? "image/jpeg";
      const uri = `data:${mime};base64,${asset.base64}`;
      await new Promise<void>(resolve => {
        addPhoto.mutate(
          { id: jobId, data: { uri, category } },
          {
            onSettled: (_data, err) => {
              if (err) failed++;
              setUploadProgress(prev => ({ ...prev, done: i + 1, failed }));
              resolve();
            },
          },
        );
      });
    }

    setUploading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const succeeded = assets.length - failed;
    if (failed === 0) {
      Alert.alert("Upload Complete", `${succeeded} photo${succeeded !== 1 ? "s" : ""} uploaded successfully.`);
    } else {
      Alert.alert(
        "Upload Finished",
        `${succeeded} uploaded, ${failed} failed. You can try again for the failed photos.`,
      );
    }
  }, [jobId, addPhoto, openFolder]);

  const downloadZip = useCallback(async (category: PhotoCategory | null) => {
    if (isDownloading) return;
    const totalCount = category
      ? photosByCategory[category].length
      : (allPhotos as PhotoItem[]).length;

    if (totalCount === 0) {
      Alert.alert("No Photos", category
        ? `No photos in the ${CATEGORIES.find(c => c.key === category)?.label ?? ""} folder.`
        : "There are no photos to download.");
      return;
    }
    setIsDownloading(true);
    const catParam = category ? `?category=${category}` : "";
    const url = `${getBaseUrl()}/api/jobs/${jobId}/photos/zip${catParam}`;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const catLabel = category
      ? (CATEGORIES.find(c => c.key === category)?.label ?? "Photos") + " Photos"
      : "All Photos";
    const filename = `Job-${jobId}-${catLabel.replace(/\s+/g, "-")}.zip`;

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
          await shareAsync(fileUri, { mimeType: "application/zip", dialogTitle: catLabel });
        } else {
          Alert.alert("Saved", "ZIP saved to device.");
        }
      }
    } catch (e) {
      Alert.alert("Download Failed", e instanceof Error ? e.message : "Could not download photos.");
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, photosByCategory, allPhotos, jobId, token]);

  const downloadSinglePhoto = useCallback(async (photo: PhotoItem) => {
    if (isDownloading) return;
    setIsDownloading(true);
    const filename = `photo-${photo.id}-${Date.now()}.jpg`;
    try {
      const fileUri = (cacheDirectory ?? "") + filename;
      const idx = photo.uri.indexOf(",");
      const b64 = idx >= 0 ? photo.uri.slice(idx + 1) : photo.uri;
      await writeAsStringAsync(fileUri, b64, { encoding: EncodingType.Base64 });
      const canShare = await isSharingAvailable();
      if (canShare) {
        await shareAsync(fileUri, { mimeType: "image/jpeg", dialogTitle: filename, UTI: "public.jpeg" });
      } else {
        Alert.alert("Saved", "Photo saved to device.");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save photo.");
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  const handleDeletePhoto = useCallback((photoId: number) => {
    Alert.alert("Delete Photo", "Remove this photo from the job?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePhoto.mutate({ id: jobId, photoId }) },
    ]);
  }, [jobId, deletePhoto]);

  const openFolder$ = openFolder;
  const currentCat = CATEGORIES.find(c => c.key === openFolder$);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ──────────── FOLDER LIST VIEW ──────────── */}
      {openFolder === null && (
        <>
          {/* Toolbar */}
          <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.screenTitle, { color: colors.foreground }]}>Photo Albums</Text>
              <Text style={[styles.screenSub, { color: colors.mutedForeground }]}>
                {(allPhotos as PhotoItem[]).length} total photos
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={[styles.toolbarBtn, { borderColor: colors.border }]}
                onPress={() => downloadZip(null)}
                disabled={isDownloading || (allPhotos as PhotoItem[]).length === 0}
              >
                {isDownloading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <>
                    <Feather name="download" size={14} color={colors.primary} />
                    <Text style={[styles.toolbarBtnText, { color: colors.primary }]}>All</Text>
                  </>}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={startCategoryPicker}
              activeOpacity={0.85}
            >
              <Feather name="upload" size={18} color="#FFF" />
              <Text style={styles.addBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {/* Upload progress banner */}
          {uploading && (
            <View style={[styles.progressBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.progressText, { color: colors.primary }]}>
                Uploading {uploadProgress.done} of {uploadProgress.total} photos…
              </Text>
            </View>
          )}

          {/* Folder grid */}
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={CATEGORIES}
              keyExtractor={c => c.key}
              numColumns={2}
              contentContainerStyle={styles.folderGrid}
              columnWrapperStyle={{ gap: 12 }}
              renderItem={({ item: cat }) => {
                const count = photosByCategory[cat.key].length;
                const thumb = photosByCategory[cat.key][0];
                return (
                  <TouchableOpacity
                    style={[styles.folderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    activeOpacity={0.8}
                    onPress={() => setOpenFolder(cat.key)}
                  >
                    <View style={[styles.folderThumb, { backgroundColor: cat.color + "18" }]}>
                      {thumb ? (
                        <Image source={{ uri: thumb.uri }} style={styles.folderThumbImg} resizeMode="cover" />
                      ) : (
                        <Text style={styles.folderEmoji}>📁</Text>
                      )}
                    </View>
                    <View style={styles.folderInfo}>
                      <Text style={[styles.folderLabel, { color: colors.foreground }]}>{cat.label}</Text>
                      <Text style={[styles.folderCount, { color: colors.mutedForeground }]}>
                        {count} photo{count !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View style={[styles.folderBadge, { backgroundColor: cat.color }]}>
                      <Text style={styles.folderBadgeText}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}

      {/* ──────────── FOLDER DETAIL VIEW ──────────── */}
      {openFolder !== null && (
        <>
          {/* Folder header */}
          <View style={[styles.folderHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setOpenFolder(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.folderHeaderTitle, { color: colors.foreground }]}>
                📁 {currentCat?.label} Photos
              </Text>
              <Text style={[styles.folderHeaderCount, { color: colors.mutedForeground }]}>
                {folderPhotos.length} photo{folderPhotos.length !== 1 ? "s" : ""}
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={[styles.toolbarBtn, { borderColor: colors.border }]}
                onPress={() => downloadZip(openFolder)}
                disabled={isDownloading || folderPhotos.length === 0}
              >
                {isDownloading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <>
                    <Feather name="download" size={14} color={colors.primary} />
                    <Text style={[styles.toolbarBtnText, { color: colors.primary }]}>ZIP</Text>
                  </>}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={startCategoryPicker}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Upload progress banner */}
          {uploading && (
            <View style={[styles.progressBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.progressText, { color: colors.primary }]}>
                Uploading {uploadProgress.done} of {uploadProgress.total} photos…
              </Text>
            </View>
          )}

          {/* Photo grid */}
          {folderPhotos.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>📁</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No {currentCat?.label} Photos Yet
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Tap + to upload photos into this folder
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={startCategoryPicker}
              >
                <Feather name="upload" size={16} color="#FFF" />
                <Text style={styles.emptyBtnText}>Upload Photos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={folderPhotos}
              keyExtractor={item => String(item.id)}
              numColumns={COLS}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setViewerPhoto(item)}
                  style={[styles.thumb, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumbImg} resizeMode="cover" />
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}

      {/* ──────────── CATEGORY PICKER MODAL ──────────── */}
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCategoryPickerOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Which folder?</Text>
          <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
            Select a category, then choose photos from your gallery.
          </Text>

          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catBtn, { borderColor: colors.border }]}
              onPress={() => pickFromGallery(cat.key)}
            >
              <View style={[styles.catIcon, { backgroundColor: cat.color + "20" }]}>
                <Text style={styles.catEmoji}>📁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.catLabel, { color: colors.foreground }]}>{cat.label} Photos</Text>
                <Text style={[styles.catCount, { color: colors.mutedForeground }]}>
                  {photosByCategory[cat.key].length} photo{photosByCategory[cat.key].length !== 1 ? "s" : ""} already uploaded
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}

          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={[styles.cameraRow, { borderColor: colors.border }]}
              onPress={() => {
                Alert.alert(
                  "Take Photo — Select Folder",
                  "Which folder should this photo go into?",
                  [
                    ...CATEGORIES.map(c => ({ text: c.label, onPress: () => takePhoto(c.key) })),
                    { text: "Cancel", style: "cancel" as const, onPress: () => { setCategoryPickerOpen(false); } },
                  ],
                );
                setCategoryPickerOpen(false);
              }}
            >
              <Feather name="camera" size={18} color={colors.mutedForeground} />
              <Text style={[styles.cameraRowText, { color: colors.mutedForeground }]}>Take a Photo Instead</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.muted }]}
            onPress={() => setCategoryPickerOpen(false)}
          >
            <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ──────────── FULL-SCREEN VIEWER ──────────── */}
      <Modal
        visible={!!viewerPhoto}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerPhoto(null)}
      >
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
                <Text style={styles.viewerLabel}>
                  {CATEGORIES.find(c => c.key === viewerPhoto.category)?.label ?? "Photo"}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={styles.viewerBtn}
                onPress={() => viewerPhoto && downloadSinglePhoto(viewerPhoto)}
                disabled={isDownloading}
              >
                {isDownloading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Feather name="download" size={20} color="#FFF" />}
              </TouchableOpacity>
              {isAdmin && viewerPhoto && (
                <TouchableOpacity
                  style={[styles.viewerBtn, { backgroundColor: "rgba(244,67,54,0.8)" }]}
                  onPress={() => handleDeletePhoto(viewerPhoto.id)}
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
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  screenTitle: { fontSize: 16, fontWeight: "700" },
  screenSub: { fontSize: 12, marginTop: 1 },

  folderHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  folderHeaderTitle: { fontSize: 16, fontWeight: "700" },
  folderHeaderCount: { fontSize: 12, marginTop: 1 },

  toolbarBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  toolbarBtnText: { fontSize: 12, fontWeight: "600" },

  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },

  progressBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderTopWidth: 1,
  },
  progressText: { fontSize: 13, fontWeight: "600" },

  folderGrid: {
    padding: 16, gap: 12,
  },
  folderCard: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    overflow: "hidden",
  },
  folderThumb: {
    height: 110, alignItems: "center", justifyContent: "center",
  },
  folderThumbImg: { width: "100%", height: "100%" },
  folderEmoji: { fontSize: 42 },
  folderInfo: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  folderLabel: { fontSize: 15, fontWeight: "700" },
  folderCount: { fontSize: 12, marginTop: 2 },
  folderBadge: {
    position: "absolute", top: 8, right: 8,
    borderRadius: 12, minWidth: 24, height: 24,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  folderBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  grid: { padding: GAP },
  thumb: { margin: GAP / 2, borderRadius: 4, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyEmoji: { fontSize: 56, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  emptyBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 36, paddingHorizontal: 16, paddingTop: 12,
    gap: 4,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  sheetSub: { fontSize: 13, marginBottom: 12, lineHeight: 18 },

  catBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  catIcon: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  catEmoji: { fontSize: 22 },
  catLabel: { fontSize: 15, fontWeight: "700" },
  catCount: { fontSize: 12, marginTop: 2 },

  cameraRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderTopWidth: 1, paddingTop: 14, marginTop: 4, paddingHorizontal: 4,
  },
  cameraRowText: { fontSize: 14 },

  cancelBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8,
  },
  cancelText: { fontSize: 16, fontWeight: "600" },

  viewer: { flex: 1, backgroundColor: "#000" },
  viewerImg: { flex: 1 },
  viewerBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  viewerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  viewerLabel: { color: "#FFF", fontSize: 14, fontWeight: "600" },
});
