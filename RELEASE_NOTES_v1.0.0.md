# Provision Civils — Version 1.0.0 Release Notes

**Release Date:** 3 July 2026
**Platform:** Android (APK)
**Package:** com.provisioncivils.app

---

## What is Provision Civils?

A production-ready construction job management mobile application for field teams. Admins and supervisors manage jobs, employees, invoices, and daily reports; workers track their assigned work from the field.

---

## Version 1.0.0 — Full Feature Release

### Core Features

#### Authentication & Security
- Role-based login: Admin, Supervisor, Worker
- JWT authentication with secure token storage
- **Automatic 15-minute inactivity logout** — screens lock automatically when the app is idle
- **Biometric login** — Face ID / fingerprint sign-in (enable in Settings → Security)
- App-state tracking: logs out when app returns from background after timeout

#### Job Management
- Full job lifecycle: create, edit, assign workers, track progress, complete, archive
- Status workflow: Pending → In Progress → On Hold → Completed
- GPS location capture and map view for every job site
- Photo albums per job: Before / During / After categorisation
- Daily reports with voice-to-text (English + Afrikaans)
- Materials checklist (standard + custom items)
- Equipment tracking
- Wayleave document tracking

#### Client Management
- Full client CRM: company, contact person, phone, email, address, VAT number
- Link clients directly to jobs
- Soft delete with recycle bin recovery

#### Employee Management
- Full employee profiles: ID number, clock number, employee number, job title, department
- Banking details for payroll
- Employment status tracking
- Role-based access (Admin / Supervisor / Worker)

#### Labour & Payroll
- Two pay types: **Hourly** (hours × rate) and **Piece Work** (meters × rate)
- Daily batch labour entry: log multiple employees at once per job per day
- Piece work status: Open / Complete — only complete entries count toward payroll
- Payroll summary: per employee, per job, per date range
- PDF payroll reports: summary, per-employee, per-job cost
- 26th–25th payroll cycle with quick selectors

#### Invoicing
- Generate invoices from jobs with itemised labour, materials, equipment costs
- VAT calculation
- Status tracking: Draft → Sent → Paid / Overdue
- Share invoice via device Share sheet

#### Notifications
- Real-time in-app alerts for job assignments, status changes, invoice creation
- Grouped by: Today / Yesterday / Older
- Unread badge count
- Mark individual or all as read

#### Costing & Analysis
- Profit/Loss per job: contract value vs. actual costs
- Cost breakdown: labour, materials, equipment, expenses, subcontractors
- Expense logging by category (fuel, diesel, accommodation, plant hire, tools, etc.)

#### Messages & Teams
- In-app messaging with conversation threads
- Team management and assignment

---

### Administration Features (Admin role only)

#### Company Settings
- Company name, VAT number, registration number
- Address, phone, email
- Banking details
- Default labour rates (Standard / Overtime / Night Shift)
- Payroll period configuration

#### Audit Log
- Every write action logged: user, role, action, entity, timestamp, IP address
- Filterable by user, action type, date range

#### Database Backups
- Automatic daily backups at 02:00 (30-day retention)
- Manual backup on demand
- Restore from any completed backup
- Admin notification on backup success/failure

#### System Health Dashboard
- API, database, storage, push notification status
- Last backup time and status
- Server uptime
- App version (client + server)

#### Crash Reporting
- Automatic crash capture and reporting to admin
- Full stack trace visible in admin panel
- Resolve/reopen crash reports

#### User Activity
- Online Now and Active Today counts
- Per-user last-seen timestamps
- Platform tracking (iOS / Android / Web)

#### Recycle Bin
- Soft-deleted jobs, clients, employees, invoices, photos all recoverable
- Restore or permanently delete from recycle bin
- All restore/delete actions audit-logged

---

## Bug Fixes in v1.0.0

- **Critical: Soft-deleted items now correctly hidden** — Jobs, clients, employees, and invoices that were deleted (moved to Recycle Bin) no longer appear in main lists
- **Fixed: Duplicate job numbers** — Job number generation now uses `MAX(id)` instead of `COUNT(*)`, preventing duplicates after permanent deletes
- **Fixed: Invoice list performance** — Now uses a single JOIN query instead of two sequential queries
- **Fixed: Delete feedback** — Labour entry and expense deletion now triggers haptic feedback
- **Fixed: Notifications** — Mark All as Read now shows haptic success feedback and error handling
- **Fixed: Payroll rate display** — Shows the actual effective rate (total pay ÷ total hours) instead of a hardcoded "R25/hr" label
- **Fixed: Stale query variable** — Removed unreachable code in the jobs list route

---

## Technical Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 54, Expo Router v6, React Native 0.81 |
| State | React Query (TanStack) |
| API | Express 5 (ESM), Node.js 24 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT + bcrypt |
| Validation | Zod |
| API Contract | OpenAPI 3.0 + Orval codegen |
| Build | EAS Build (Android APK) |

---

## Seeded Test Accounts

| Email | Password | Role |
|---|---|---|
| admin@provision.co.za | admin123 | Admin |
| supervisor@provision.co.za | super123 | Supervisor |
| worker@provision.co.za | work123 | Worker |

---

## Known Limitations

- Invoice PDF is text-format only (shared via device Share sheet) — binary PDF generation not included in v1.0 due to expo-print incompatibility with SDK 54
- Voice-to-text requires device microphone permission and works best on physical devices
- Biometric login requires device hardware support (fingerprint sensor or Face ID)

---

*Provision Civils v1.0.0 — Built for the field. Ready for production.*
