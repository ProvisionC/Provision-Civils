import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Linking, Image,
  Dimensions, Modal, StatusBar, SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useGetJob, useDeleteJob, useUpdateJob, useListJobPhotos,
  getListJobsQueryKey, getGetJobQueryKey, getListJobPhotosQueryKey,
} from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

const { width: SW } = Dimensions.get("window");
const THUMB = (SW - 32 - 12 * 4) / 4;

const STATUSES = ["pending", "in_progress", "waiting_for_materials", "completed", "cancelled"] as const;
const STATUS_LABELS = {
  pending: "Pending", in_progress: "In Progress",
  waiting_for_materials: "Waiting for Materials",
  completed: "Completed", cancelled: "Cancelled",
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const canEdit = isAdmin || isSupervisor;

  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const { data: job, isLoading } = useGetJob(jobId, {
    query: { queryKey: getGetJobQueryKey(jobId) },
  });

  const { data: photos } = useListJobPhotos(jobId, {
    query: { queryKey: getListJobPhotosQueryKey(jobId) },
  });

  const deleteJob = useDeleteJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        router.back();
      },
    },
  });

  const updateStatus = useUpdateJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
      },
    },
  });

  const handleDelete = () => {
    Alert.alert("Delete Job", `Delete job ${job?.jobNumber}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteJob.mutate({ id: jobId }) },
    ]);
  };

  const handleStatusChange = (status: string) => {
    updateStatus.mutate({ id: jobId, data: { status } as any });
  };

  const openMaps = () => {
    if (!job?.gpsLat || !job?.gpsLng) return;
    const url = `https://maps.google.com/?q=${job.gpsLat},${job.gpsLng}`;
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Job not found</Text>
      </View>
    );
  }

  const detail = job as any;
  const photoList = photos ?? [];
  const thumbPhotos = photoList.slice(0, 8);
  const materials: any[] = detail.materials ?? [];
  const usedMaterials = materials.filter((m: any) => m.checked && Number(m.quantity) > 0);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero card */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.jobNumber, { color: colors.primary }]}>{job.jobNumber}</Text>
            <Text style={[styles.clientName, { color: colors.foreground }]}>{job.clientName}</Text>
          </View>
          <StatusBadge status={job.status as any} />
        </View>

        {job.siteAddress && (
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{job.siteAddress}</Text>
          </View>
        )}

        {job.dueDate && (
          <View style={styles.infoRow}>
            <Feather name="calendar" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Due: {new Date(job.dueDate + "T00:00:00").toLocaleDateString()}
            </Text>
          </View>
        )}

        {job.gpsLat && job.gpsLng && (
          <TouchableOpacity style={[styles.mapsBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]} onPress={openMaps}>
            <Feather name="navigation" size={14} color={colors.primary} />
            <Text style={[styles.mapsBtnText, { color: colors.primary }]}>Open in Maps</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/job/${jobId}/photos` as any)}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="camera" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.foreground }]}>Photos</Text>
          {photoList.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{photoList.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/job/${jobId}/materials` as any)}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: "#FF6F0020" }]}>
            <Feather name="package" size={20} color="#FF6F00" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.foreground }]}>Materials</Text>
          {usedMaterials.length > 0 && (
            <View style={[styles.badge, { backgroundColor: "#FF6F00" }]}>
              <Text style={styles.badgeText}>{usedMaterials.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/job/${jobId}/reports` as any)}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.secondary + "18" }]}>
            <Feather name="clipboard" size={20} color={colors.secondary} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.foreground }]}>Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/invoice/create?jobId=${jobId}` as any)}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: "#7B1FA215" }]}>
            <Feather name="file-text" size={20} color="#7B1FA2" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.foreground }]}>Invoice</Text>
        </TouchableOpacity>
      </View>

      {/* Edit button (admin/supervisor only) */}
      {canEdit && (
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/job/${jobId}/edit` as any)}
        >
          <Feather name="edit-2" size={16} color={colors.warning} />
          <Text style={[styles.editBtnText, { color: colors.warning }]}>Edit Job Details</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
      )}

      {/* Photo thumbnails inline preview */}
      {thumbPhotos.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="image" size={15} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Photos</Text>
            </View>
            <TouchableOpacity onPress={() => router.push(`/job/${jobId}/photos` as any)}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>
                {photoList.length > 8 ? `View all ${photoList.length}` : "View all"} →
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.thumbGrid}>
            {thumbPhotos.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.thumb, { width: THUMB, height: THUMB }]}
                onPress={() => setViewerUri(p.uri)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: p.uri }} style={styles.thumbImg} resizeMode="cover" />
              </TouchableOpacity>
            ))}
            {photoList.length > 8 && (
              <TouchableOpacity
                style={[styles.thumb, styles.moreThumb, { width: THUMB, height: THUMB, backgroundColor: colors.muted }]}
                onPress={() => router.push(`/job/${jobId}/photos` as any)}
              >
                <Text style={[styles.moreText, { color: colors.foreground }]}>+{photoList.length - 8}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Status update */}
      {canEdit && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Update Status</Text>
          <View style={styles.statusChips}>
            {STATUSES.map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: job.status === s ? colors.primary : colors.muted,
                    borderColor: job.status === s ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleStatusChange(s)}
                disabled={job.status === s || updateStatus.isPending}
              >
                <Text style={{ color: job.status === s ? "#FFF" : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                  {STATUS_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {(job.description || job.notes) && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {job.description && (
            <>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Description</Text>
              <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>{job.description}</Text>
            </>
          )}
          {job.notes && (
            <>
              <Text style={[styles.cardTitle, { color: colors.foreground, marginTop: 12 }]}>Notes</Text>
              <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>{job.notes}</Text>
            </>
          )}
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Contact</Text>
        {job.clientPhone && (
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${job.clientPhone}`)}>
            <Feather name="phone" size={14} color={colors.primary} />
            <Text style={[styles.contactText, { color: colors.primary }]}>{job.clientPhone}</Text>
          </TouchableOpacity>
        )}
        {job.clientEmail && (
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${job.clientEmail}`)}>
            <Feather name="mail" size={14} color={colors.primary} />
            <Text style={[styles.contactText, { color: colors.primary }]}>{job.clientEmail}</Text>
          </TouchableOpacity>
        )}
        {job.labourHours && (
          <View style={styles.contactRow}>
            <Feather name="clock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.contactText, { color: colors.mutedForeground }]}>{job.labourHours}h labour</Text>
          </View>
        )}
      </View>

      {/* Materials summary */}
      {usedMaterials.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="package" size={15} color="#FF6F00" />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Materials Used</Text>
            </View>
            <TouchableOpacity onPress={() => router.push(`/job/${jobId}/materials` as any)}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>Edit →</Text>
            </TouchableOpacity>
          </View>
          {usedMaterials.map((m: any) => (
            <View key={m.id} style={[styles.matRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.matCheck, { backgroundColor: "#FF6F0020" }]}>
                <Feather name="check" size={11} color="#FF6F00" />
              </View>
              <Text style={[styles.matName, { color: colors.foreground }]}>{m.name}</Text>
              <Text style={[styles.matQty, { color: colors.mutedForeground }]}>×{Number(m.quantity)}</Text>
            </View>
          ))}
          {materials.length > usedMaterials.length && (
            <TouchableOpacity onPress={() => router.push(`/job/${jobId}/materials` as any)}>
              <Text style={[styles.moreLink, { color: colors.mutedForeground }]}>
                +{materials.length - usedMaterials.length} more items in checklist
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {materials.length === 0 && (
        <TouchableOpacity
          style={[styles.card, styles.materialsCta, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/job/${jobId}/materials` as any)}
        >
          <Feather name="package" size={22} color="#FF6F00" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Materials Checklist</Text>
            <Text style={[styles.ctaSubtitle, { color: colors.mutedForeground }]}>Track materials used on this job</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {detail.equipment?.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Equipment</Text>
          {detail.equipment.map((e: any) => (
            <View key={e.id} style={styles.tableRow}>
              <Text style={[styles.tableName, { color: colors.foreground }]}>{e.name}</Text>
              <Text style={[styles.tableVal, { color: colors.mutedForeground }]}>×{e.quantity}</Text>
              {e.cost != null && <Text style={[styles.tableVal, { color: colors.mutedForeground }]}>R{Number(e.cost).toFixed(2)}</Text>}
            </View>
          ))}
        </View>
      )}

      {detail.workers?.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Assigned Workers</Text>
          {detail.workers.map((w: any) => (
            <View key={w.id} style={styles.workerRow}>
              <View style={[styles.workerAvatar, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.workerInitials, { color: colors.primary }]}>
                  {w.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </Text>
              </View>
              <Text style={[styles.workerName, { color: colors.foreground }]}>{w.name}</Text>
              <Text style={[styles.workerRole, { color: colors.mutedForeground }]}>{w.role}</Text>
            </View>
          ))}
        </View>
      )}

      {isAdmin && (
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.destructive }]}
          onPress={handleDelete}
          disabled={deleteJob.isPending}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Job</Text>
        </TouchableOpacity>
      )}

      {/* Full-screen photo viewer */}
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
            <Image source={{ uri: viewerUri }} style={styles.viewerImg} resizeMode="contain" />
          )}
          <SafeAreaView style={styles.viewerBar}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
              <Feather name="x" size={22} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroCard: {
    margin: 16, borderRadius: 16, padding: 20, borderWidth: 1, gap: 10,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  jobNumber: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  clientName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  mapsBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, alignSelf: "flex-start",
  },
  mapsBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  quickActions: { flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  actionBtn: {
    flex: 1, borderRadius: 12, padding: 12, borderWidth: 1,
    alignItems: "center", gap: 4, position: "relative",
  },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  badge: {
    position: "absolute", top: 6, right: 6,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
  editBtn: {
    marginHorizontal: 12, marginBottom: 12, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10,
  },
  editBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card: { marginHorizontal: 12, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  viewAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  thumb: { borderRadius: 6, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  moreThumb: { alignItems: "center", justifyContent: "center", borderRadius: 6 },
  moreText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  statusChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  statusChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  contactText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  matRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  matCheck: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  matName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  matQty: { fontSize: 13, fontFamily: "Inter_500Medium" },
  moreLink: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center" },
  materialsCta: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  ctaTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  ctaSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  tableName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  tableVal: { fontSize: 13, fontFamily: "Inter_400Regular" },
  workerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  workerAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  workerInitials: { fontSize: 12, fontFamily: "Inter_700Bold" },
  workerName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  workerRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
  deleteBtn: {
    marginHorizontal: 12, marginBottom: 16, borderRadius: 12, borderWidth: 1,
    paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  deleteBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerImg: { flex: 1 },
  viewerBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "flex-start",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 44 : 12,
  },
  viewerClose: {
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, padding: 10,
  },
});
