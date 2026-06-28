import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, Dimensions,
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

const { width } = Dimensions.get("window");
const PHOTO_SIZE = (width - 48) / 3;

export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();

  const { data: photos, isLoading } = useListJobPhotos(jobId, {
    query: { queryKey: getListJobPhotosQueryKey(jobId) },
  });

  const addPhoto = useAddJobPhoto({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListJobPhotosQueryKey(jobId) });
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as any,
      quality: 0.5,
      base64: true,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert("Error", "Could not read image data"); return; }
      const uri = `data:image/jpeg;base64,${asset.base64}`;
      addPhoto.mutate({ id: jobId, data: { uri } });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      base64: true,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!asset.base64) { Alert.alert("Error", "Could not read image data"); return; }
      const uri = `data:image/jpeg;base64,${asset.base64}`;
      addPhoto.mutate({ id: jobId, data: { uri } });
    }
  };

  const handleDelete = (photoId: number) => {
    Alert.alert("Delete Photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePhoto.mutate({ id: jobId, photoId }) },
    ]);
  };

  const showOptions = () => {
    Alert.alert("Add Photo", "Choose source", [
      { text: "Camera", onPress: takePhoto },
      { text: "Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {photos?.length ?? 0} photo{photos?.length !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={showOptions}>
          {addPhoto.isPending ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="camera" size={18} color="#FFF" />}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : photos?.length === 0 ? (
        <View style={styles.center}>
          <Feather name="image" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No photos yet</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={showOptions}>
            <Text style={styles.emptyBtnText}>Add First Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={item => String(item.id)}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.photo, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
              onLongPress={() => handleDelete(item.id)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: item.uri }} style={styles.photoImage} resizeMode="cover" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  grid: { padding: 12, gap: 4 },
  photo: { margin: 2, borderRadius: 8, overflow: "hidden" },
  photoImage: { width: "100%", height: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptyBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
});
