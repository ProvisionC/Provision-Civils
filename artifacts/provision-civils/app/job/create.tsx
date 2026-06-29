import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList,
  Switch, type KeyboardTypeOptions,
} from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useCreateJob, useListEmployees, useListClients,
  getListJobsQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";

export default function CreateJobScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isPM = user?.role === "project_manager";
  const canSeeCost = isAdmin;

  const [form, setForm] = useState({
    clientId: "" as string,
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    projectName: "",
    projectNumber: "",
    supervisorId: "" as string,
    projectManagerId: "" as string,
    siteAddress: "",
    description: "",
    notes: "",
    labourHours: "",
    startDate: "",
    dueDate: "",
    poNumber: "",
    clientOrderNumber: "",
    contractValue: "",
    wayleaveRequired: false,
  });

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const { data: employees } = useListEmployees();
  const { data: clients } = useListClients({});
  const supervisors = employees?.filter(e => e.role === "supervisor" || e.role === "admin") ?? [];
  const pms = employees?.filter(e => e.role === "project_manager" || e.role === "admin") ?? [];
  const filteredClients = clients?.filter(c =>
    !clientSearch || c.companyName.toLowerCase().includes(clientSearch.toLowerCase())
  ) ?? [];

  const createJob = useCreateJob({
    mutation: {
      onSuccess: (job) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        router.replace(`/job/${job.id}` as any);
      },
      onError: () => Alert.alert("Error", "Failed to create job. Please try again."),
    },
  });

  const set = (key: string, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

  const handleSelectClient = (client: { id: number; companyName: string; contactPerson?: string | null; phone?: string | null; email?: string | null }) => {
    setForm(f => ({
      ...f,
      clientId: String(client.id),
      clientName: client.companyName,
      clientPhone: client.phone ?? f.clientPhone,
      clientEmail: client.email ?? f.clientEmail,
    }));
    setShowClientPicker(false);
    setClientSearch("");
  };

  const handleSubmit = () => {
    if (!form.clientName.trim()) {
      Alert.alert("Validation", "Client name is required");
      return;
    }
    createJob.mutate({
      data: {
        clientId: form.clientId ? Number(form.clientId) : undefined,
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone || undefined,
        clientEmail: form.clientEmail || undefined,
        projectName: form.projectName || undefined,
        projectNumber: form.projectNumber || undefined,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : undefined,
        projectManagerId: form.projectManagerId ? Number(form.projectManagerId) : undefined,
        siteAddress: form.siteAddress || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
        labourHours: form.labourHours ? Number(form.labourHours) : undefined,
        startDate: form.startDate || undefined,
        dueDate: form.dueDate || undefined,
        poNumber: form.poNumber || undefined,
        clientOrderNumber: form.clientOrderNumber || undefined,
        contractValue: form.contractValue ? Number(form.contractValue) : undefined,
        wayleaveRequired: form.wayleaveRequired,
        status: "active",
      },
    });
  };

  return (
    <>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section: Client */}
        <SectionHeader label="Client Details" icon="users" colors={colors} />
        <TouchableOpacity
          style={[styles.pickerBtn, { backgroundColor: colors.input, borderColor: colors.border }]}
          onPress={() => setShowClientPicker(true)}
        >
          <Feather name="users" size={16} color={form.clientId ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.pickerText, { color: form.clientId ? colors.foreground : colors.mutedForeground }]}>
            {form.clientName || "Select from client list..."}
          </Text>
          {form.clientId && (
            <TouchableOpacity onPress={() => setForm(f => ({ ...f, clientId: "", clientName: "" }))}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {!form.clientId && <Feather name="chevron-down" size={16} color={colors.mutedForeground} />}
        </TouchableOpacity>

        <Field label="Client Name *" value={form.clientName} onChangeText={v => set("clientName", v)} placeholder="Company or individual name" colors={colors} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Phone" value={form.clientPhone} onChangeText={v => set("clientPhone", v)} placeholder="+27 xx xxx xxxx" keyboardType="phone-pad" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Email" value={form.clientEmail} onChangeText={v => set("clientEmail", v)} placeholder="email@co.za" keyboardType="email-address" colors={colors} />
          </View>
        </View>

        {/* Section: Project */}
        <SectionHeader label="Project Details" icon="briefcase" colors={colors} />
        <Field label="Project Name" value={form.projectName} onChangeText={v => set("projectName", v)} placeholder="e.g. Phase 2 Trenching — JHB North" colors={colors} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Project No." value={form.projectNumber} onChangeText={v => set("projectNumber", v)} placeholder="P-2024-001" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Site Address" value={form.siteAddress} onChangeText={v => set("siteAddress", v)} placeholder="123 Main Rd" colors={colors} />
          </View>
        </View>

        {/* Section: Team */}
        <SectionHeader label="Team Assignment" icon="user-check" colors={colors} />
        <View>
          <Text style={[styles.label, { color: colors.foreground }]}>Supervisor</Text>
          <View style={[styles.segmented, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.segmentedOption, form.supervisorId === "" && { backgroundColor: colors.card }]}
              onPress={() => set("supervisorId", "")}
            >
              <Text style={{ color: form.supervisorId === "" ? colors.foreground : colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>None</Text>
            </TouchableOpacity>
            {supervisors.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.segmentedOption, form.supervisorId === String(s.id) && { backgroundColor: colors.card }]}
                onPress={() => set("supervisorId", String(s.id))}
              >
                <Text style={{ color: form.supervisorId === String(s.id) ? colors.primary : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }} numberOfLines={1}>
                  {s.name.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {(isAdmin || isPM) && (
          <View>
            <Text style={[styles.label, { color: colors.foreground }]}>Project Manager</Text>
            <View style={[styles.segmented, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.segmentedOption, form.projectManagerId === "" && { backgroundColor: colors.card }]}
                onPress={() => set("projectManagerId", "")}
              >
                <Text style={{ color: form.projectManagerId === "" ? colors.foreground : colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>None</Text>
              </TouchableOpacity>
              {pms.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.segmentedOption, form.projectManagerId === String(p.id) && { backgroundColor: colors.card }]}
                  onPress={() => set("projectManagerId", String(p.id))}
                >
                  <Text style={{ color: form.projectManagerId === String(p.id) ? colors.primary : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }} numberOfLines={1}>
                    {p.name.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Section: Schedule */}
        <SectionHeader label="Schedule" icon="calendar" colors={colors} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Start Date" value={form.startDate} onChangeText={v => set("startDate", v)} placeholder="YYYY-MM-DD" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Expected Completion" value={form.dueDate} onChangeText={v => set("dueDate", v)} placeholder="YYYY-MM-DD" colors={colors} />
          </View>
        </View>

        {/* Section: Commercial (admin only) */}
        {canSeeCost && (
          <>
            <SectionHeader label="Commercial" icon="dollar-sign" colors={colors} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="PO Number" value={form.poNumber} onChangeText={v => set("poNumber", v)} placeholder="PO-2024-xxx" colors={colors} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Client Order No." value={form.clientOrderNumber} onChangeText={v => set("clientOrderNumber", v)} placeholder="CO-xxx" colors={colors} />
              </View>
            </View>
            <Field label="Contract Value (R)" value={form.contractValue} onChangeText={v => set("contractValue", v)} placeholder="0.00" keyboardType="decimal-pad" colors={colors} />

            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.toggleInfo}>
                <Feather name="file" size={16} color={form.wayleaveRequired ? colors.warning : colors.mutedForeground} />
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Wayleave Required</Text>
                  <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>Job needs a signed Wayleave document</Text>
                </View>
              </View>
              <Switch
                value={form.wayleaveRequired}
                onValueChange={v => set("wayleaveRequired", v)}
                trackColor={{ true: colors.warning, false: colors.border }}
                thumbColor="#FFF"
              />
            </View>
          </>
        )}

        {/* Section: Details */}
        <SectionHeader label="Job Details" icon="file-text" colors={colors} />
        <Field label="Labour Hours (estimated)" value={form.labourHours} onChangeText={v => set("labourHours", v)} placeholder="e.g. 40" keyboardType="numeric" colors={colors} />
        <Field label="Description" value={form.description} onChangeText={v => set("description", v)} placeholder="Scope of work, objectives..." multiline colors={colors} />
        <Field label="Notes" value={form.notes} onChangeText={v => set("notes", v)} placeholder="Site-specific notes, access, hazards..." multiline colors={colors} />

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }, createJob.isPending && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={createJob.isPending}
          activeOpacity={0.85}
        >
          {createJob.isPending ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#FFF" />
              <Text style={styles.submitText}>Create Job</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Client picker modal */}
      <Modal visible={showClientPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowClientPicker(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Client</Text>
            <View style={styles.modalHeaderRight}>
              <TouchableOpacity
                style={[styles.newClientBtn, { backgroundColor: colors.primary }]}
                onPress={() => { setShowClientPicker(false); router.push("/client/create"); }}
              >
                <Feather name="plus" size={14} color="#FFF" />
                <Text style={styles.newClientBtnText}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                <Feather name="x" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.clientSearch, { backgroundColor: colors.input, borderBottomColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.clientSearchInput, { color: colors.foreground }]}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Search clients..."
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredClients}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            ListEmptyComponent={
              <View style={styles.noClients}>
                <Text style={[styles.noClientsText, { color: colors.mutedForeground }]}>No clients found</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.clientItem, { backgroundColor: colors.card, borderColor: colors.border }, form.clientId === String(item.id) && { borderColor: colors.primary }]}
                onPress={() => handleSelectClient(item)}
              >
                <View style={[styles.clientAvatar, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.clientAvatarText, { color: colors.primary }]}>{item.companyName.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.clientName, { color: colors.foreground }]}>{item.companyName}</Text>
                  {item.contactPerson && <Text style={[styles.clientContact, { color: colors.mutedForeground }]}>{item.contactPerson}</Text>}
                </View>
                {form.clientId === String(item.id) && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

interface FieldProps {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: KeyboardTypeOptions;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}
function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, colors }: FieldProps) {
  return (
    <View>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, multiline && styles.multiline]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground} multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

function SectionHeader({ label, icon, colors }: { label: string; icon: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
      <Feather name={icon as any} size={15} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  segmented: { flexDirection: "row", borderRadius: 10, borderWidth: 1, overflow: "hidden", padding: 4, gap: 4 },
  segmentedOption: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6, alignItems: "center" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
  toggleInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalHeaderRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  newClientBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  newClientBtnText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  clientSearch: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  clientSearchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  noClients: { padding: 32, alignItems: "center" },
  noClientsText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  clientItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 14, borderWidth: 1 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  clientAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  clientName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  clientContact: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
});
