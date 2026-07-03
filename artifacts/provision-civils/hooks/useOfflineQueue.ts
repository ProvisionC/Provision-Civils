import { useEffect, useRef, useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { sendMessage } from "@workspace/api-client-react";

export type QueuedMessage = {
  id: string;
  conversationId: number;
  payload: {
    type?: string;
    content: string;
    fileName?: string;
    fileMime?: string;
    replyToId?: number;
    mentions?: number[];
    voiceDuration?: number;
  };
  createdAt: string;
  retries: number;
};

const QUEUE_KEY = "offline_message_queue";

async function loadQueue(): Promise<QueuedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveQueue(q: QueuedMessage[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function useOfflineQueue(onMessageSent?: (conversationId: number) => void) {
  const [queueLength, setQueueLength] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const flushingRef = useRef(false);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      let queue = await loadQueue();
      const failed: QueuedMessage[] = [];
      for (const item of queue) {
        try {
          await sendMessage(item.conversationId, item.payload as any);
          onMessageSent?.(item.conversationId);
        } catch {
          if (item.retries < 3) failed.push({ ...item, retries: item.retries + 1 });
        }
      }
      await saveQueue(failed);
      setQueueLength(failed.length);
    } finally {
      flushingRef.current = false;
    }
  }, [onMessageSent]);

  useEffect(() => {
    loadQueue().then(q => setQueueLength(q.length));
    const unsub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected;
      setIsOnline(online);
      if (online) flushQueue();
    });
    return () => unsub();
  }, [flushQueue]);

  const enqueue = useCallback(async (conversationId: number, payload: QueuedMessage["payload"]) => {
    const item: QueuedMessage = {
      id: `${Date.now()}-${Math.random()}`,
      conversationId, payload,
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    const queue = await loadQueue();
    queue.push(item);
    await saveQueue(queue);
    setQueueLength(queue.length);
  }, []);

  return { isOnline, queueLength, enqueue, flushQueue };
}
