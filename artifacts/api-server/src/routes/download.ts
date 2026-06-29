import { Router, type IRouter } from "express";
import { existsSync } from "fs";
import { resolve } from "path";

const router: IRouter = Router();

const APK_PATH = resolve("/home/runner/workspace/provision-civils.apk");

router.get("/download/apk", (req, res) => {
  if (!existsSync(APK_PATH)) {
    res.status(404).json({ error: "APK not found on server." });
    return;
  }
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", 'attachment; filename="provision-civils.apk"');
  res.sendFile(APK_PATH);
});

export default router;
