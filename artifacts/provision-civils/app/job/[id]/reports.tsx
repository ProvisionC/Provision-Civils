import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView,
  Animated, Image, Platform, Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useColors } from "@/hooks/useColors";
import {
  useListDailyReports, useCreateDailyReport,
  getListDailyReportsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useSpeechToText } from "@/hooks/useSpeechToText";

const TODAY = new Date().toISOString().split("T")[0];
const { width: SW } = Dimensions.get("window");
const THUMB_SIZE = 80;

type FieldKey = "workCompleted" | "labourOnSite" | "problemsEncountered" | "tomorrowWork" | "notes";

interface FormState {
  date: string;
  workCompleted: string;
  problemsEncountered: string;
  tomorrowWork: string;
  labourOnSite: string;
  notes: string;
  progressNotes: string;
}

const BLANK_FORM: FormState = {
  date: TODAY,
  workCompleted: "",
  problemsEncountered: "",
  tomorrowWork: "",
  labourOnSite: "",
  notes: "",
  progressNotes: "",
};

export default function DailyReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor" || user?.role === "admin" || user?.role === "project_manager";

  const { data: reports, isLoading } = useListDailyReports(jobId, {
    query: { queryKey: getListDailyReportsQueryKey(jobId) },
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { isListening, isAvailable, partialTranscript, startListening, stopListening } = useSpeechToText();

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 550, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  const captureGPS = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      // GPS unavailable — proceed without it
    } finally {
      setGpsLoading(false);
    }
  }, []);

  const openModal = useCallback(async () => {
    setShowModal(true);
    setForm({ ...BLANK_FORM, date: new Date().toISOString().split("T")[0] });
    setPhotos([]);
    setGpsCoords(null);
    captureGPS();
  }, [captureGPS]);

  const handleMicPress = async (field: FieldKey) => {
    if (!isAvailable) {
      Alert.alert(
        "Voice Not Available",
        "Speech recognition is not available on this device. Please type your notes manually.",
        [{ text: "OK" }]
      );
      return;
    }

    if (isListening && activeField === field) {
      stopListening();
      stopPulse();
      setActiveField(null);
      return;
    }

    if (isListening) {
      stopListening();
      stopPulse();
    }

    setActiveField(field);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startPulse();

    await startListening((text) => {
      setForm(f => ({
        ...f,
        [field]: f[field] ? f[field].trim() + " " + text : text,
      }));
      stopPulse();
      setActiveField(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, "af-ZA");
  };

  const pickPhotosFromGallery = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow photo library access to attach photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.45,
        base64: true,
        exif: false,
        selectionLimit: 10,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPhotos(prev => [...prev, ...result.assets].slice(0, 10));
      }
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow camera access to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.45,
        base64: true,
        exif: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPhotos(prev => [...prev, result.assets[0]].slice(0, 10));
      }
    } catch {
      Alert.alert("Error", "Could not open camera.");
    }
  }, []);

  const removePhoto = useCallback((idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const createReport = useCreateDailyReport({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey(jobId) });
        setShowModal(false);
        setForm(BLANK_FORM);
        setPhotos([]);
        setGpsCoords(null);
      },
      onError: () => Alert.alert("Error", "Failed to create report"),
    },
  });

  const handleSubmit = async () => {
    if (!form.date) { Alert.alert("Validation", "Date is required"); return; }
    if (isListening) stopListening();

    // Convert photos to base64 data URIs
    const photoUris: string[] = photos.map(asset => {
      if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
      if (asset.uri.startsWith("data:")) return asset.uri;
      return asset.uri;
    }).filter(Boolean);

    createReport.mutate({
      id: jobId,
      data: {
        date: form.date,
        workCompleted: form.workCompleted || undefined,
        problemsEncountered: form.problemsEncountered || undefined,
        tomorrowWork: form.tomorrowWork || undefined,
        labourOnSite: form.labourOnSite || undefined,
        notes: form.notes || undefined,
        progressNotes: form.progressNotes || undefined,
        photoUris: photoUris.length > 0 ? photoUris : undefined,
        gpsLat: gpsCoords?.lat ?? undefined,
        gpsLng: gpsCoords?.lng ?? undefined,
      },
    });
  };

  const handleModalClose = () => {
    if (isListening) stopListening();
    stopPulse();
    setActiveField(null);
    setShowModal(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {reports?.length ?? 0} report{reports?.length !== 1 ? "s" : ""}
        </Text>
        {isSupervisor && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openModal}
          >
            <Feather name="plus" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>New Report</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (reports?.length ?? 0) === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No reports yet</Text>
          {isSupervisor && (
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={openModal}
            >
              <Text style={styles.emptyBtnText}>Add First Report</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const r = item as any;
            const hasPhotos = r.photoUris?.length > 0;
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.dateBadge, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="calendar" size={13} color={colors.primary} />
                    <Text style={[styles.date, { color: colors.primary }]}>
                      {new Date(item.date + "T00:00:00").toLocaleDateString("en-ZA", {
                        weekday: "short", year: "numeric", month: "short", day: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={styles.cardMeta}>
                    {r.gpsLat && (
                      <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    )}
                    {hasPhotos && (
                      <View style={[styles.photoBadge, { backgroundColor: colors.primary + "15" }]}>
                        <Feather name="image" size={11} color={colors.primary} />
                        <Text style={[styles.photoBadgeText, { color: colors.primary }]}>
                          {r.photoUris.length}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.time, { color: colors.mutedForeground }]}>
                      {new Date(item.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>

                {(r.workCompleted || item.progressNotes) && (
                  <ReportSection colors={colors} icon="check-square" title="Work Completed"
                    text={r.workCompleted || item.progressNotes} />
                )}
                {r.problemsEncountered && (
                  <ReportSection colors={colors} icon="alert-triangle" title="Problems Encountered"
                    text={r.problemsEncountered} iconColor="#E65100" />
                )}
                {r.tomorrowWork && (
                  <ReportSection colors={colors} icon="arrow-right-circle" title="Tomorrow's Work"
                    text={r.tomorrowWork} />
                )}
                {r.labourOnSite && (
                  <ReportSection colors={colors} icon="users" title="Labour on Site"
                    text={r.labourOnSite} />
                )}
                {item.notes && (
                  <ReportSection colors={colors} icon="mic" title="Voice / Additional Notes"
                    text={item.notes} />
                )}

                {hasPhotos && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={styles.cardPhotoRow} contentContainerStyle={{ gap: 6 }}>
                    {(r.photoUris as string[]).slice(0, 8).map((uri, idx) => (
                      <Image
                        key={idx}
                        source={{ uri }}
                        style={[styles.cardThumb, { borderColor: colors.border }]}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleModalClose}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Supervisor Daily Report
              </Text>
              {isListening && (
                <View style={styles.listeningBanner}>
                  <Animated.View style={[styles.listeningDot, { transform: [{ scale: pulseAnim }] }]} />
                  <Text style={styles.listeningText}>
                    {partialTranscript
                      ? `"${partialTranscript}"`
                      : "Listening… (speak in Afrikaans or English)"}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={handleModalClose}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 18, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Date */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Date *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={form.date}
                onChangeText={v => setForm(f => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <VoiceField label="Work Completed Today *" value={form.workCompleted}
              onChangeText={v => setForm(f => ({ ...f, workCompleted: v }))}
              placeholder="Describe all work completed today…"
              field="workCompleted" activeField={activeField} isListening={isListening}
              onMicPress={handleMicPress} colors={colors} pulseAnim={pulseAnim} />

            <VoiceField label="Labour on Site" value={form.labourOnSite}
              onChangeText={v => setForm(f => ({ ...f, labourOnSite: v }))}
              placeholder="e.g. 4 workers, 1 operator"
              field="labourOnSite" activeField={activeField} isListening={isListening}
              onMicPress={handleMicPress} colors={colors} pulseAnim={pulseAnim} multiline={false} />

            <VoiceField label="Problems / Delays Encountered" value={form.problemsEncountered}
              onChangeText={v => setForm(f => ({ ...f, problemsEncountered: v }))}
              placeholder="Any problems, delays, or safety issues…"
              field="problemsEncountered" activeField={activeField} isListening={isListening}
              onMicPress={handleMicPress} colors={colors} pulseAnim={pulseAnim} />

            <VoiceField label="Tomorrow's Planned Work" value={form.tomorrowWork}
              onChangeText={v => setForm(f => ({ ...f, tomorrowWork: v }))}
              placeholder="Describe planned work for tomorrow…"
              field="tomorrowWork" activeField={activeField} isListening={isListening}
              onMicPress={handleMicPress} colors={colors} pulseAnim={pulseAnim} />

            <VoiceField label="Voice Notes / Additional Remarks" value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Tap the mic and speak in Afrikaans or English…"
              field="notes" activeField={activeField} isListening={isListening}
              onMicPress={handleMicPress} colors={colors} pulseAnim={pulseAnim} />

            {/* ── Photos Section ── */}
            <View>
              <View style={styles.sectionHeaderRow}>
                <Feather name="image" size={14} color={colors.primary} />
                <Text style={[styles.label, { color: colors.foreground }]}>
                  Site Photos {photos.length > 0 ? `(${photos.length})` : ""}
                </Text>
              </View>

              {photos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbRow}
                  contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                >
                  {photos.map((asset, idx) => (
                    <View key={idx} style={styles.thumbContainer}>
                      <Image
                        source={{ uri: asset.uri }}
                        style={styles.thumb}
                      />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => removePhoto(idx)}
                        hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                      >
                        <Feather name="x" size={11} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: colors.primary + "12", borderColor: colors.border }]}
                  onPress={pickPhotosFromGallery}
                  disabled={photos.length >= 10}
                >
                  <Feather name="image" size={16} color={colors.primary} />
                  <Text style={[styles.photoBtnText, { color: colors.primary }]}>Gallery</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" && (
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: colors.primary + "12", borderColor: colors.border }]}
                    onPress={takePhoto}
                    disabled={photos.length >= 10}
                  >
                    <Feather name="camera" size={16} color={colors.primary} />
                    <Text style={[styles.photoBtnText, { color: colors.primary }]}>Camera</Text>
                  </TouchableOpacity>
                )}
              </View>
              {photos.length >= 10 && (
                <Text style={[styles.photoLimit, { color: colors.mutedForeground }]}>
                  Maximum 10 photos per report
                </Text>
              )}
            </View>

            {/* ── GPS Status ── */}
            <View style={[styles.gpsRow, { borderColor: colors.border }]}>
              {gpsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather
                  name="map-pin"
                  size={14}
                  color={gpsCoords ? "#2E7D32" : colors.mutedForeground}
                />
              )}
              <Text style={[styles.gpsText, { color: gpsCoords ? "#2E7D32" : colors.mutedForeground }]}>
                {gpsLoading
                  ? "Capturing location…"
                  : gpsCoords
                  ? `GPS captured (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)})`
                  : "Location not captured"}
              </Text>
              {!gpsCoords && !gpsLoading && (
                <TouchableOpacity onPress={captureGPS} style={[styles.gpsCapture, { borderColor: colors.primary }]}>
                  <Text style={[styles.gpsCaptureText, { color: colors.primary }]}>Capture</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, createReport.isPending && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={createReport.isPending}
            >
              {createReport.isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFF" />
                  <Text style={styles.submitText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

interface VoiceFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  field: FieldKey;
  activeField: FieldKey | null;
  isListening: boolean;
  onMicPress: (field: FieldKey) => void;
  colors: any;
  pulseAnim: Animated.Value;
  multiline?: boolean;
}

function VoiceField({
  label, value, onChangeText, placeholder,
  field, activeField, isListening, onMicPress,
  colors, pulseAnim, multiline = true,
}: VoiceFieldProps) {
  const isActive = isListening && activeField === field;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        <TouchableOpacity
          style={[
            styles.micBtn,
            {
              backgroundColor: isActive ? "#FFEBEE" : colors.primary + "15",
              borderColor: isActive ? "#E53935" : colors.border,
            },
          ]}
          onPress={() => onMicPress(field)}
          activeOpacity={0.7}
        >
          {isActive ? (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Feather name="mic" size={14} color="#E53935" />
            </Animated.View>
          ) : (
            <Feather name="mic" size={14} color={colors.primary} />
          )}
          <Text style={[styles.micLabel, { color: isActive ? "#E53935" : colors.primary }]}>
            {isActive ? "Stop" : "Dictate"}
          </Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.input,
            borderColor: isActive ? "#E53935" : colors.border,
            color: colors.foreground,
          },
          multiline && styles.multiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
      />
    </View>
  );
}

function ReportSection({
  colors, icon, title, text, iconColor,
}: {
  colors: any; icon: string; title: string; text: string; iconColor?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderEl}>
        <Feather name={icon as any} size={13} color={iconColor ?? colors.primary} />
        <Text style={[styles.sectionTitle, { color: iconColor ?? colors.primary }]}>{title}</Text>
      </View>
      <Text style={[styles.sectionText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptyBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  date: { fontSize: 13, fontFamily: "Inter_700Bold" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  photoBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  photoBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardPhotoRow: { marginTop: 4 },
  cardThumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 1 },
  section: { gap: 4 },
  sectionHeaderEl: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginLeft: 19 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, gap: 12,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  listeningBanner: { flexDirection: "row", alignItems: "center", gap: 8 },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E53935" },
  listeningText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#E53935", flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  micBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  micLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular",
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  thumbRow: { marginBottom: 10 },
  thumbContainer: { position: "relative" },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10 },
  thumbRemove: {
    position: "absolute", top: -6, right: -6,
    backgroundColor: "#E53935", borderRadius: 10,
    width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },
  photoActions: { flexDirection: "row", gap: 10 },
  photoBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 12,
  },
  photoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  photoLimit: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
  gpsRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  gpsText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  gpsCapture: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  gpsCaptureText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  submitBtn: {
    borderRadius: 12, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
