import { useAuth } from "@/context/AuthContext";

export function useRBAC() {
  const { user } = useAuth();
  
  const isAdmin = user?.role === "admin";
  const isProjectManager = user?.role === "project_manager" || isAdmin;
  const isSupervisor = user?.role === "supervisor" || isProjectManager;
  const isWorker = user?.role === "worker";

  return {
    isAdmin,
    isProjectManager,
    isSupervisor,
    isWorker,
    user
  };
}
