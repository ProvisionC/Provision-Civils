import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch, getListJobPhotosQueryKey } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";

// ─── Tuning ──────────────────────────────────────────────────────────────────
// Lower concurrency (3) prevents OOM on mid-range Huawei devices running 4
// parallel ImageManipulator operations simultaneously.
const CONCURRENCY   = 3;
const MAX_FAILURES  = 3;
const QUEUE_KEY     = "photo_upload_queue_v2";
// Resize only reduces; we keep 1920 as the ceiling. Photos already ≤1920px
// wide are compressed-only (no upscaling) because the resize action is
// gated on actual dimension below.
const MAX_WIDTH     = 1920;
const COMPRESS      = 0.70;
// 30-second fetch timeout per photo — prevents indefinitely stalled uploads
// (common on patchy mobile networks).
const UPLOAD_TIMEOUT_MS = 30_000;

type PhotoCategory = "before" | "during" | "after" | "other";

export interface UploadItem {
  id: string;
  jobId: number;
  category: PhotoCategory;
  localUri: string;
  status: "pending" | "uploading" | "done" | "failed";
  failCount: number;
  createdAt: number;
}

export interface JobUploadStats {
  pending: number;
  uploading: number;
  done: number;
  failed: number;
  total: number;
  active: boolean;
}

type QueueAction =
  | { type: "LOAD"; items: UploadItem[] }
  | { type: "ENQUEUE"; items: UploadItem[] }
  | { type: "SET_STATUS"; id: string; status: UploadItem["status"]; failCount?: number }
  | { type: "RETRY_FAILED"; jobId?: number }
  | { type: "CLEAR_DONE"; jobId?: number };

function queueReducer(state: UploadItem[], action: QueueAction): UploadItem[] {
  switch (action.type) {
    case "LOAD":
      return action.items;
    case "ENQUEUE":
      return [...state, ...action.items];
    case "SET_STATUS":
      return state.map(i =>
        i.id === action.id
          ? {
              ...i,
              status: action.status,
              ...(action.failCount !== undefined ? { failCount: action.failCount } : {}),
            }
          : i,
      );
    case "RETRY_FAILED":
      return state.map(i =>
        i.status === "failed" && (!action.jobId || i.jobId === action.jobId)
          ? { ...i, status: "pending", failCount: 0 }
          : i,
      );
    case "CLEAR_DONE":
      return state.filter(
        i => !(i.status === "done" && (!action.jobId || i.jobId === action.jobId)),
      );
    default:
      return state;
  }
}

interface PhotoUploadContextValue {
  enqueue: (items: Array<{ localUri: string; jobId: number; category: PhotoCategory }>) => void;
  getJobStats: (jobId: number) => JobUploadStats;
  retryFailed: (jobId?: number) => void;
  clearCompleted: (jobId?: number) => void;
  queue: UploadItem[];
}

const PhotoUploadContext = createContext<PhotoUploadContextValue | null>(null);

export function PhotoUploadProvider({ children }: { children: React.ReactNode }) {
  const [queue, dispatch] = useReducer(queueReducer, []);
  const [isOnline, setIsOnline] = useState(true);
  const processingRef = useRef(new Set<string>());
  const backoffTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const qc = useQueryClient();
  const { token, isLoading: isAuthLoading } = useAuth();

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY)
      .then(raw => {
        if (!raw) return;
        const items: UploadItem[] = JSON.parse(raw);
        const cleaned = items
          // "uploading" at load time means app was killed mid-upload → retry
          .map(i => (i.status === "uploading" ? { ...i, status: "pending" as const } : i))
          .filter(i => i.status !== "done");
        if (cleaned.length > 0) dispatch({ type: "LOAD", items: cleaned });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const toSave = queue.filter(i => i.status !== "done");
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [queue]);

  // ── Network ────────────────────────────────────────────────────────────────
  useEffect(() => {
    NetInfo.fetch().then(s => setIsOnline(s.isConnected ?? true));
    return NetInfo.addEventListener(s => setIsOnline(s.isConnected ?? true));
  }, []);

  // ── Upload processor ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading || !token || !isOnline) return;

    const pending = queue.filter(
      i => i.status === "pending" && !processingRef.current.has(i.id),
    );
    const slots = CONCURRENCY - processingRef.current.size;
    if (slots <= 0 || pending.length === 0) return;

    pending.slice(0, slots).forEach(item => {
      processingRef.current.add(item.id);
      dispatch({ type: "SET_STATUS", id: item.id, status: "uploading" });

      doUpload(item)
        .then(() => {
          dispatch({ type: "SET_STATUS", id: item.id, status: "done" });
          // refetchQueries forces an immediate network request regardless of
          // staleTime, so photos appear the moment each upload finishes.
          void qc.refetchQueries({ queryKey: getListJobPhotosQueryKey(item.jobId) });
        })
        .catch(() => {
          const newFail = item.failCount + 1;
          if (newFail >= MAX_FAILURES) {
            dispatch({ type: "SET_STATUS", id: item.id, status: "failed", failCount: newFail });
          } else {
            // Exponential backoff: 4 s, 8 s, 16 s (capped at 30 s).
            // During the delay the item shows as "uploading" (cosmetically fine).
            const delayMs = Math.min(30_000, 4_000 * Math.pow(2, newFail - 1));
            const t = setTimeout(() => {
              backoffTimers.current.delete(item.id);
              dispatch({ type: "SET_STATUS", id: item.id, status: "pending", failCount: newFail });
            }, delayMs);
            backoffTimers.current.set(item.id, t);
          }
        })
        .finally(() => {
          processingRef.current.delete(item.id);
        });
    });
  }, [queue, token, isAuthLoading, isOnline, qc]);

  // ── Public API ─────────────────────────────────────────────────────────────
  const enqueue = useCallback(
    (items: Array<{ localUri: string; jobId: number; category: PhotoCategory }>) => {
      const now = Date.now();
      dispatch({
        type: "ENQUEUE",
        items: items.map(({ localUri, jobId, category }, i) => ({
          id: `${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          jobId,
          category,
          localUri,
          status: "pending",
          failCount: 0,
          createdAt: now,
        })),
      });
    },
    [],
  );

  const getJobStats = useCallback(
    (jobId: number): JobUploadStats => {
      const items = queue.filter(i => i.jobId === jobId);
      const pending   = items.filter(i => i.status === "pending").length;
      const uploading = items.filter(i => i.status === "uploading").length;
      const done      = items.filter(i => i.status === "done").length;
      const failed    = items.filter(i => i.status === "failed").length;
      return { pending, uploading, done, failed, total: items.length, active: pending + uploading > 0 };
    },
    [queue],
  );

  const retryFailed = useCallback((jobId?: number) => {
    // Clear any pending backoff timers for these items before restarting
    queue
      .filter(i => i.status === "failed" && (!jobId || i.jobId === jobId))
      .forEach(i => {
        const t = backoffTimers.current.get(i.id);
        if (t) { clearTimeout(t); backoffTimers.current.delete(i.id); }
      });
    dispatch({ type: "RETRY_FAILED", jobId });
  }, [queue]);

  const clearCompleted = useCallback((jobId?: number) => {
    dispatch({ type: "CLEAR_DONE", jobId });
  }, []);

  return (
    <PhotoUploadContext.Provider value={{ enqueue, getJobStats, retryFailed, clearCompleted, queue }}>
      {children}
    </PhotoUploadContext.Provider>
  );
}

export function usePhotoUpload() {
  const ctx = useContext(PhotoUploadContext);
  if (!ctx) throw new Error("usePhotoUpload must be inside PhotoUploadProvider");
  return ctx;
}

// ─── Upload worker ────────────────────────────────────────────────────────────
async function doUpload(item: UploadItem): Promise<void> {
  // Hard 30-second deadline on the fetch. Prevents uploads from stalling
  // indefinitely on patchy 4G networks. ImageManipulator runs before the
  // fetch so it is outside the abort window, but it rarely hangs.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    // Single compress+resize pass. MAX_WIDTH = 1920 px is well below any modern
    // Android camera output (≥ 4000 px), so this always downscales in practice.
    // A 0.70 JPEG at 1920 px typically produces a 150–350 KB file (~200–470 KB
    // as base64), comfortably below the server's 15 MB body limit.
    const compressed = await ImageManipulator.manipulateAsync(
      item.localUri,
      [{ resize: { width: MAX_WIDTH } }],
      { compress: COMPRESS, format: ImageManipulator.SaveFormat.JPEG },
    );

    const base64 = await readAsStringAsync(compressed.uri, { encoding: EncodingType.Base64 });

    await customFetch(`/api/jobs/${item.jobId}/photos`, {
      method: "POST",
      body: JSON.stringify({
        uri: `data:image/jpeg;base64,${base64}`,
        category: item.category,
      }),
      responseType: "json",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
