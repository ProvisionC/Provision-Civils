import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Alert, ActivityIndicator, Dimensions, Modal, Platform,
  StatusBar, SafeAreaView, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useListJobPhotos, useAddJobPhoto, useDeleteJobPhoto,
  getListJobPhotosQueryKey,
} from "@workspace/api-client-react";

const { width: SW, height: SH } = Dimensions.get("window");
const COLS = 3;
const GAP = 3;
const PHOTO_SIZE = (SW - GAP * (COLS + 1)) / COLS;

export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: photos, isLoading } = useListJobPhotos(jobId, {
    query: { queryKey: getListJobPhotosQueryKey(jobId) },
  });

  const addPhoto = useAddJobPhoto({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListJobPhotosQueryKey(jobId) });
        setUploading(false);
      },
      onError: () => {
        setUploading(false);
        Alert.alert("Upload Failed", "Could not save photo. Please try again.");
      },
    },
  });

  const deletePhoto = useDeleteJobPhoto({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListJobPhotosQueryKey(jobId) });
      },
    },
  });

  const processAsset = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      Alert.alert("Error", "Could not read image. Please try again.");
      setUploading(false);
      return;
    }
    const mime = asset.mimeType ?? "image/jpeg";
    const uri = `data:${mime};base64,${asset.base64}`;
    addPhoto.mutate({ id: jobId, data: { uri } });
  };

  const takePhoto = async () => {
    setSheetOpen(false);
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Camera is not available in the browser. Please use the Expo Go app on your device.");
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission Denied", "Please allow camera access in your device settings.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        base64: true,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        processAsset(result.assets[0]);
      }
    } catch (e) {
      setUploading(false);
      Alert.alert("Error", "Could not open camera.");
    }
  };

  const pickFromGallery = async () => {
    setSheetOpen(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission Denied", "Please allow photo library access in your device settings.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images" as any,
        quality: 0.5,
        base64: true,
        exif: false,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        processAsset(result.assets[0]);
      }
    } catch (e) {
      setUploading(false);
      Alert.alert("Error", "Could not open gallery.");
    }
  };

  const handleLongPress = (photoId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Photo", "Remove this photo from the job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deletePhoto.mutate({ id: jobId, photoId }),
      },
    ]);
  };

  const isPending = uploading || addPhoto.isPending;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header row */}
      <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {photos?.length ?? 0} photo{photos?.length !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }, isPending && styles.disabled]}
          onPress={() => setSheetOpen(true)}
          disabled={isPending}
          activeOpacity={0.8}
        >
          {isPending
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Feather name="camera" size={18} color="#FFF" />}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !photos || photos.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Photos Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Tap the camera button to add photos to this job
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setSheetOpen(true)}
            disabled={isPending}
          >
            <Feather name="camera" size={16} color="#FFF" />
            <Text style={styles.emptyBtnText}>Add First Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={item => String(item.id)}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setViewerUri(item.uri)}
              onLongPress={() => handleLongPress(item.id)}
              style={[styles.thumb, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
            >
              <Image
                source={{ uri: item.uri }}
                style={styles.thumbImg}
                resizeMode="cover"
              />
              <View style={styles.thumbOverlay}>
                <Feather name="zoom-in" size={14} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Action Sheet Modal */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSheetOpen(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add Photo</Text>

          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={[styles.sheetBtn, { borderBottomColor: colors.border }]}
              onPress={takePhoto}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="camera" size={20} color={colors.primary} />
              </View>
              <View style={styles.sheetBtnText}>
                <Text style={[styles.sheetBtnLabel, { color: colors.foreground }]}>Take Photo</Text>
                <Text style={[styles.sheetBtnSub, { color: colors.mutedForeground }]}>Use camera</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.sheetBtn, { borderBottomColor: colors.border }]}
            onPress={pickFromGallery}
          >
            <View style={[styles.sheetIconWrap, { backgroundColor: colors.secondary + "20" }]}>
              <Feather name="image" size={20} color={colors.secondary} />
            </View>
            <View style={styles.sheetBtnText}>
              <Text style={[styles.sheetBtnLabel, { color: colors.foreground }]}>Choose from Gallery</Text>
              <Text style={[styles.sheetBtnSub, { color: colors.mutedForeground }]}>Select existing photo</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.muted }]}
            onPress={() => setSheetOpen(false)}
          >
            <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Full-screen Viewer Modal */}
      <Modal
        visible={!!viewerUri}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.viewer}>
          <StatusBar hidden />
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImg}
              resizeMode="contain"
            />
          )}
          <SafeAreaView style={styles.viewerBar}>
            <TouchableOpacity
              style={styles.viewerClose}
              onPress={() => setViewerUri(null)}
            >
              <Feather name="x" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewerDelete, { backgroundColor: "rgba(244,67,54,0.8)" }]}
              onPress={() => {
                const photo = photos?.find(p => p.uri === viewerUri);
                if (photo) {
                  setViewerUri(null);
                  handleLongPress(photo.id);
                }
              }}
            >
              <Feather name="trash-2" size={18} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  count: { fontSize: 14, fontFamily: "Inter_500Medium" },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  disabled: { opacity: 0.6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  grid: { padding: GAP },
  thumb: { margin: GAP / 2, borderRadius: 6, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  thumbOverlay: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 4, padding: 3,
  },
  // Action sheet
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 40, paddingHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  sheetBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  sheetIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  sheetBtnText: { flex: 1 },
  sheetBtnLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sheetBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cancelBtn: {
    marginTop: 16, borderRadius: 12, paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  // Viewer
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerImg: { flex: 1 },
  viewerBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 44 : 12,
  },
  viewerClose: {
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20,
    padding: 10,
  },
  viewerDelete: {
    borderRadius: 20, padding: 10,
  },
});
