import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import dashboardRouter from "./dashboard.js";
import jobsRouter from "./jobs.js";
import clientsRouter from "./clients.js";
import expensesRouter from "./expenses.js";
import employeesRouter from "./employees.js";
import invoicesRouter from "./invoices.js";
import notificationsRouter from "./notifications.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(jobsRouter);
router.use(clientsRouter);
router.use(expensesRouter);
router.use(employeesRouter);
router.use(invoicesRouter);
router.use(notificationsRouter);

export default router;
