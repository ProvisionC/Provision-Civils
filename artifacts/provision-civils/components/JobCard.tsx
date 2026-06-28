import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "./StatusBadge";
import type { Job } from "@workspace/api-client-react";

interface JobCardProps {
  job: Job;
  onPress?: () => void;
}

export function JobCard({ job, onPress }: JobCardProps) {
  const colors = useColors();
  const isOverdue = job.dueDate && new Date(job.dueDate) < new Date() && job.status !== "completed" && job.status !== "cancelled";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.jobNumber, { color: colors.primary }]}>{job.jobNumber}</Text>
          <StatusBadge status={job.status as any} size="sm" />
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>

      <Text style={[styles.clientName, { color: colors.foreground }]} numberOfLines={1}>
        {job.clientName}
      </Text>

      {job.siteAddress ? (
        <View style={styles.addressRow}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={1}>
            {job.siteAddress}
          </Text>
        </View>
      ) : null}

      {job.dueDate ? (
        <View style={styles.dueRow}>
          <Feather name="clock" size={12} color={isOverdue ? colors.destructive : colors.mutedForeground} />
          <Text style={[styles.dueDate, { color: isOverdue ? colors.destructive : colors.mutedForeground }]}>
            Due: {new Date(job.dueDate + "T00:00:00").toLocaleDateString()}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  jobNumber: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  clientName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  address: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dueDate: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
