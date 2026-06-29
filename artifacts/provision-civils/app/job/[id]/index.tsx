import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Linking, Image,
  Dimensions, Modal, StatusBar, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useGetJob, useDeleteJob, useUpdateJob, useListJobPhotos,
  getListJobsQueryKey, getGetJobQueryKey, getListJobPhotosQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { usePdfExport } from "@/hooks/usePdfExport";

const { width: SW } = Dimensions.get("window");
const THUMB = (SW - 32 - 12 * 4) / 4;

const JOB_STATUSES = [
  { key: "active", label: "Active", color: "#1565C0" },
  { key: "waiting_for_wayleave", label: "Waiting for Wayleave", color: "#F57F17" },
  { key: "completed", label: "Completed", color: "#2E7D32" },
  { key: "cancelled", label: "Cancelled", color: "#C62828" },
] as const;

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  fuel: "Fuel", diesel: "Diesel", accommodation: "Accommodation",
  labour: "Labour", plant_hire: "Plant Hire", tools: "Tools",
  concrete: "Concrete", materials: "Materials", subcontractors: "Subcontractors", other: "Other",
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isPM = user?.role === "project_manager";
  const isSupervisor = user?.role === "supervisor";
  const canEdit = isAdmin || isSupervisor || isPM;

  const { isExporting, exportPdf } = usePdfExport();

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
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
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

  const handleCompleteJob = () => {
    const j = job as any;
    if (j?.wayleaveRequired) {
      Alert.alert(
        "Wayleave Required",
        "This job requires a Wayleave document. Status will change to 'Waiting for Wayleave'. Admin must upload the document before the job can be marked as completed.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Submit for Wayleave",
            onPress: () => updateStatus.mutate({ id: jobId, data: { status: "waiting_for_wayleave" } as any }),
          },
        ]
      );
    } else {
      Alert.alert(
        "Complete Job",
        "Are you sure you want to mark this job as completed?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Complete",
            onPress: () => updateStatus.mutate({ id: jobId, data: { status: "completed" } as any }),
          },
        ]
      );
    }
  };

  const handleMarkCompleted = () => {
    Alert.alert(
      "Mark as Completed",
      "Confirm that the Wayleave document has been received and the job is now complete.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Completed",
          onPress: () => updateStatus.mutate({ id: jobId, data: { status: "completed" } as any }),
        },
      ]
    );
  };

  const openMaps = () => {
    if (!job?.gpsLat || !job?.gpsLng) {
      Alert.alert(
        "No GPS Coordinates",
        "This job does not have GPS coordinates recorded yet. Add them by editing the job.",
        [{ text: "OK" }]
      );
      return;
    }
    const url = `https://maps.google.com/?q=${job.gpsLat},${job.gpsLng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Cannot Open Maps", "Could not open maps app on this device.")
    );
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

  const isActive = job.status === "active" || job.status === "in_progress" || job.status === "pending";
  const isWaitingWayleave = job.status === "waiting_for_wayleave";
  const isCompleted = job.status === "completed";
  const canComplete = (isSupervisor || isAdmin) && (isActive);

  return (
    <>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.jobNumber, { color: colors.primary }]}>{job.jobNumber}</Text>
              {detail.projectName ? (
                <>
                  <Text style={[styles.projectName, { color: colors.foreground }]}>{detail.projectName}</Text>
                  <Text style={[styles.clientNameSub, { color: colors.mutedForeground }]}>{job.clientName}</Text>
                </>
              ) : (
                <Text style={[styles.projectName, { color: colors.foreground }]}>{job.clientName}</Text>
              )}
            </View>
            <StatusBadge status={job.status as any} />
          </View>

          {detail.projectNumber && (
            <View style={styles.infoRow}>
              <Feather name="hash" size={13} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Project {detail.projectNumber}</Text>
            </View>
          )}

          {job.siteAddress && (
            <View style={styles.infoRow}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{job.siteAddress}</Text>
            </View>
          )}

          {(detail.startDate || detail.dueDate) && (
            <View style={styles.infoRow}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                {detail.startDate ? new Date(detail.startDate + "T00:00:00").toLocaleDateString("en-ZA") : "—"}
                {" → "}
                {detail.dueDate ? new Date(detail.dueDate + "T00:00:00").toLocaleDateString("en-ZA") : "—"}
              </Text>
            </View>
          )}

          {isAdmin && detail.contractValue && (
            <View style={[styles.contractBadge, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="briefcase" size={13} color={colors.primary} />
              <Text style={[styles.contractText, { color: colors.primary }]}>
                Contract Value: R {Number(detail.contractValue).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}

          {isAdmin && detail.poNumber && (
            <View style={styles.infoRow}>
              <Feather name="file-text" size={13} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>PO: {detail.poNumber}</Text>
            </View>
          )}

          {true && (
            <TouchableOpacity
              style={[styles.mapsBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
              onPress={openMaps}
            >
              <Feather name="navigation" size={14} color={colors.primary} />
              <Text style={[styles.mapsBtnText, { color: colors.primary }]}>Open in Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Wayleave banner */}
        {isWaitingWayleave && (
          <View style={[styles.wayleaveCard, { backgroundColor: "#FFF3E0", borderColor: "#FF8F00" }]}>
            <Feather name="clock" size={18} color="#E65100" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.wayleaveTitle, { color: "#BF360C" }]}>Waiting for Wayleave</Text>
              <Text style={[styles.wayleaveText, { color: "#E65100" }]}>
                Awaiting signed Wayleave document from admin before this job can be marked complete.
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={[styles.wayleaveBtn, { backgroundColor: "#E65100" }]}
                onPress={handleMarkCompleted}
              >
                <Text style={{ color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Mark Complete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

          {isAdmin && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/job/${jobId}/expenses` as any)}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: "#7B1FA215" }]}>
                <Feather name="dollar-sign" size={20} color="#7B1FA2" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Expenses</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/job/${jobId}/labour` as any)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: "#22C55E18" }]}>
              <Feather name="users" size={20} color="#22C55E" />
            </View>
            <Text style={[styles.actionLabel, { color: colors.foreground }]}>Labour</Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/job/${jobId}/costing` as any)}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: "#F59E0B18" }]}>
                <Feather name="bar-chart-2" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Costing</Text>
            </TouchableOpacity>
          )}

          {!isAdmin && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/invoice/create?jobId=${jobId}` as any)}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: "#7B1FA215" }]}>
                <Feather name="file-text" size={20} color="#7B1FA2" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Invoice</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Admin Invoice row */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.invoiceBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/invoice/create?jobId=${jobId}` as any)}
          >
            <Feather name="file-text" size={16} color="#7B1FA2" />
            <Text style={[styles.invoiceBtnText, { color: "#7B1FA2" }]}>Create Invoice for this Job</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        )}

        {/* Edit button */}
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

        {/* Complete Job button */}
        {canComplete && (
          <TouchableOpacity
            style={[styles.completeBtn, { backgroundColor: "#2E7D32" }]}
            onPress={handleCompleteJob}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Feather name="check-circle" size={18} color="#FFF" />
                <Text style={styles.completeBtnText}>Complete Job</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Photo thumbnails */}
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

        {/* Admin status update */}
        {isAdmin && !isCompleted && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Update Status</Text>
            <View style={styles.statusChips}>
              {JOB_STATUSES.map(s => (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: job.status === s.key ? s.color : colors.muted,
                      borderColor: job.status === s.key ? s.color : colors.border,
                    },
                  ]}
                  onPress={() => updateStatus.mutate({ id: jobId, data: { status: s.key } as any })}
                  disabled={job.status === s.key || updateStatus.isPending}
                >
                  <Text style={{ color: job.status === s.key ? "#FFF" : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Job description / notes */}
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

        {/* Contact & project info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Project Info</Text>
          {job.clientPhone && (
            <TouchableOpacity style={styles.infoDetailRow} onPress={() => Linking.openURL(`tel:${job.clientPhone}`)}>
              <Feather name="phone" size={14} color={colors.primary} />
              <Text style={[styles.infoDetailText, { color: colors.primary }]}>{job.clientPhone}</Text>
            </TouchableOpacity>
          )}
          {job.clientEmail && (
            <TouchableOpacity style={styles.infoDetailRow} onPress={() => Linking.openURL(`mailto:${job.clientEmail}`)}>
              <Feather name="mail" size={14} color={colors.primary} />
              <Text style={[styles.infoDetailText, { color: colors.primary }]}>{job.clientEmail}</Text>
            </TouchableOpacity>
          )}
          {job.labourHours && (
            <View style={styles.infoDetailRow}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={[styles.infoDetailText, { color: colors.mutedForeground }]}>{job.labourHours}h estimated labour</Text>
            </View>
          )}
          {isAdmin && detail.clientOrderNumber && (
            <View style={styles.infoDetailRow}>
              <Feather name="file" size={14} color={colors.mutedForeground} />
              <Text style={[styles.infoDetailText, { color: colors.mutedForeground }]}>Client Order: {detail.clientOrderNumber}</Text>
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
            {usedMaterials.slice(0, 5).map((m: any) => (
              <View key={m.id} style={[styles.matRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.matCheck, { backgroundColor: "#FF6F0020" }]}>
                  <Feather name="check" size={11} color="#FF6F00" />
                </View>
                <Text style={[styles.matName, { color: colors.foreground }]}>{m.name}</Text>
                <Text style={[styles.matQty, { color: colors.mutedForeground }]}>×{Number(m.quantity)}</Text>
              </View>
            ))}
            {materials.length > 5 && (
              <TouchableOpacity onPress={() => router.push(`/job/${jobId}/materials` as any)}>
                <Text style={[styles.moreLink, { color: colors.mutedForeground }]}>
                  +{materials.length - 5} more items in checklist
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

        {isAdmin && (
          <View style={[styles.exportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.exportHeader}>
              <Feather name="file-text" size={16} color={colors.primary} />
              <Text style={[styles.exportTitle, { color: colors.foreground }]}>PDF Reports</Text>
              {isExporting && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: "auto" }} />}
            </View>
            <Text style={[styles.exportSub, { color: colors.mutedForeground }]}>
              Generate professional A4 reports for this job
            </Text>

            <View style={styles.exportBtns}>
              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
                onPress={() => exportPdf({
                  endpoint: `/api/jobs/${jobId}/pdf/materials`,
                  filename: `${(job as any)?.jobNumber ?? "JOB"}-Materials.pdf`,
                })}
                disabled={isExporting}
              >
                <Feather name="package" size={18} color={colors.primary} />
                <Text style={[styles.exportBtnLabel, { color: colors.primary }]}>Materials{"\n"}Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: "#FF6F0012", borderColor: "#FF6F0030" }]}
                onPress={() => exportPdf({
                  endpoint: `/api/jobs/${jobId}/pdf/reports`,
                  filename: `${(job as any)?.jobNumber ?? "JOB"}-DailyReports.pdf`,
                })}
                disabled={isExporting}
              >
                <Feather name="clipboard" size={18} color="#FF6F00" />
                <Text style={[styles.exportBtnLabel, { color: "#FF6F00" }]}>Daily{"\n"}Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: "#2E7D3212", borderColor: "#2E7D3230" }]}
                onPress={() => exportPdf({
                  endpoint: `/api/jobs/${jobId}/pdf/completion`,
                  filename: `${(job as any)?.jobNumber ?? "JOB"}-CompletionPack.pdf`,
                })}
                disabled={isExporting}
              >
                <Feather name="award" size={18} color="#2E7D32" />
                <Text style={[styles.exportBtnLabel, { color: "#2E7D32" }]}>Completion{"\n"}Pack</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: "#1565C012", borderColor: "#1565C030" }]}
                onPress={() => exportPdf({
                  endpoint: `/api/jobs/${jobId}/pdf/photos`,
                  filename: `${(job as any)?.jobNumber ?? "JOB"}-Photos.pdf`,
                })}
                disabled={isExporting}
              >
                <Feather name="image" size={18} color="#1565C0" />
                <Text style={[styles.exportBtnLabel, { color: "#1565C0" }]}>Photo{"\n"}Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: "#7B1FA212", borderColor: "#7B1FA230" }]}
                onPress={() => router.push(`/payroll/job/${jobId}` as any)}
                disabled={isExporting}
              >
                <Feather name="dollar-sign" size={18} color="#7B1FA2" />
                <Text style={[styles.exportBtnLabel, { color: "#7B1FA2" }]}>Payroll{"\n"}Cost</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.exportHint, { color: colors.mutedForeground }]}>
              PDFs include company branding, page numbers, and all job data
            </Text>
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
      </ScrollView>

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
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroCard: { margin: 16, borderRadius: 16, padding: 20, borderWidth: 1, gap: 10 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  jobNumber: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  projectName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  clientNameSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  contractBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  contractText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mapsBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, alignSelf: "flex-start" },
  mapsBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  wayleaveCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  wayleaveTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  wayleaveText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  wayleaveBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  quickActions: { flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  actionBtn: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, alignItems: "center", gap: 4, position: "relative" },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
  invoiceBtn: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  invoiceBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  editBtn: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  editBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  completeBtn: { marginHorizontal: 12, marginBottom: 12, borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  completeBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
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
  infoDetailRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  infoDetailText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  matRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  matCheck: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  matName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  matQty: { fontSize: 13, fontFamily: "Inter_500Medium" },
  moreLink: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center" },
  materialsCta: { flexDirection: "row", alignItems: "center", gap: 12 },
  ctaTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  ctaSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  exportCard: { marginHorizontal: 12, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1 },
  exportHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  exportTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  exportSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
  exportBtns: { flexDirection: "row", gap: 8, marginBottom: 10 },
  exportBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center", gap: 6 },
  exportBtnLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  exportHint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  deleteBtn: { marginHorizontal: 12, marginBottom: 16, borderRadius: 12, borderWidth: 1, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  deleteBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerImg: { flex: 1 },
  viewerBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "flex-start", paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 44 : 12 },
  viewerClose: { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, padding: 10 },
});
