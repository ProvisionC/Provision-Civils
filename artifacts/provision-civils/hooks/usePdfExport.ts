import { Platform, Alert } from "react-native";
import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { downloadAsync } from "expo-file-system";
import { cacheDirectory } from "expo-file-system/legacy";
import { isAvailableAsync, shareAsync } from "expo-sharing";

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

export interface PdfExportOptions {
  endpoint: string;
  filename: string;
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

export function usePdfExport() {
  const { token } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(
    async ({ endpoint, filename, onSuccess, onError }: PdfExportOptions) => {
      setIsExporting(true);
      const url = `${API_DOMAIN}${endpoint}`;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      try {
        if (Platform.OS === "web") {
          const response = await fetch(url, { headers });
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          onSuccess?.();
        } else {
          const fileUri = (cacheDirectory ?? "") + filename;
          const { status } = await downloadAsync(url, fileUri, {
            headers,
          });
          if (status !== 200) {
            throw new Error(`Download failed: HTTP ${status}`);
          }
          const canShare = await isAvailableAsync();
          if (canShare) {
            await shareAsync(fileUri, {
              mimeType: "application/pdf",
              dialogTitle: filename.replace(/-/g, " ").replace(".pdf", ""),
              UTI: "com.adobe.pdf",
            });
          } else {
            Alert.alert("Saved", `PDF saved to device cache.`);
          }
          onSuccess?.();
        }
      } catch (err) {
        if (onError) {
          onError(err);
        } else {
          Alert.alert(
            "Export Failed",
            err instanceof Error ? err.message : String(err)
          );
        }
      } finally {
        setIsExporting(false);
      }
    },
    [token]
  );

  return { isExporting, exportPdf };
}
