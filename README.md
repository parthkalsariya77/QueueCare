# QueueCare — Smart Hospital Queue Management System

A full-stack, database-backed healthcare platform designed to streamline outpatient consultation queues and eliminate hospital waiting room uncertainty.

QueueCare directly addresses the core problem of **patient waiting-time uncertainty, anxiety, and crowded OPD waiting rooms** by providing an intuitive patient discovery & queue tracking experience connected in real-time to a hospital staff operational console, powered by an explainable **Adaptive ETA Engine (EWMA)**.

---

## 🌟 Key Features

1. **Patient Discovery & Search Marketplace**:
   - Filter by specialty, locality (Ahmedabad & Gandhinagar area), and maximum current OPD queue wait time.
   - Keyword search across hospitals, doctors, and symptoms (e.g. *fever, heart, bones, skin*).
   - Dynamic live queue waiting time badges calculated directly from current doctor workloads.
2. **Instant Digital OPD Tokens**:
   - Time slot selection, one-click booking, and unique token generation (e.g., `GEN-103`).
   - Frictionless reception or mobile check-in to enter the active queue sequence.
3. **Live Centerpiece Queue Tracker**:
   - Large digital token display.
   - Shows currently serving token, number of patients ahead, and adaptive wait time with an indicative planning range (e.g., `~18m (14–23m)`).
   - Visual progress bar and live staff operational delay announcements.
   - Near real-time auto-polling every 3.5s without manual page refreshes.
4. **Connected Hospital Staff Console**:
   - Call next patient into consultation.
   - Complete consultation with simulated duration (4m, 6m, 8m, 10m, custom) which actively updates the doctor's learned pace.
   - Add operational delays (+5m, +10m) with patient-visible explanations.
   - Pause and resume queues for ward rounds or emergencies.
   - Mark no-shows or reschedule patient appointments.
5. **Adaptive ETA Engine (Technical Differentiator)**:
   - Uses Exponentially Weighted Moving Average (EWMA, $\alpha = 0.30$) over completed consultations.
   - Blends with department median benchmark using Bayesian smoothing ($k=5$).
   - Dynamically accounts for ongoing consultation elapsed time and queue positions.
6. **1-Click Demo Reset**:
   - Restores the clean demonstration dataset relative to today's date anytime.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18, v20, or v22)
- npm

### 1. Installation
```bash
npm install
```

### 2. Run Database Seeding
```bash
npm run db:reset
```
*Seeds 4 fictional hospitals in Ahmedabad/Gandhinagar, 12 departments, 13 doctors, 180+ historical consultation durations, and an active queue entry for the Demo Patient at Zydus Hospital.*

### 3. Start Development Server
```bash
npm run dev
```
Starts both the Express API server (port 3001) and the Vite React application (port 5173).
- **Patient Portal**: [http://localhost:5173](http://localhost:5173)
- **Staff Operations Console**: [http://localhost:5173/staff](http://localhost:5173/staff)

### 4. Run Automated Tests
```bash
npm test
```
Runs 14 unit and integration tests verifying EWMA calculation, department smoothing, queue state transitions, and staff updates.

### 5. Production Build
```bash
npm run build
```

---

## 🎭 Live Academic Demonstration Script

Follow these steps to demonstrate QueueCare to the evaluator:

| Step | Action | What to Point Out |
|---|---|---|
| **1. Patient Dashboard** | Open `http://localhost:5173` | Point out the active ticket banner for **Demo Patient (Token GEN-103)** waiting at Zydus Hospital. |
| **2. Hospital Discovery** | Click **"Find Hospitals"** in the top navigation. Type *"heart"* or *"cardiology"*. | Show that search matches symptoms to departments and displays real-time OPD waiting times. Sort by *"Shortest Queue"*. |
| **3. Live Queue Tracker** | Click **"Live Queue Tracker"** | Point out the large token display (`GEN-103`), currently serving token (`GEN-101`), 1 patient ahead, and adaptive wait time with planning range. |
| **4. Staff Delay Action** | In another tab/window, switch to **Staff Portal** (top right button). Select Dr. Rajesh Patel. Click **"Add Delay"** and add `+10 mins`. | Switch back to the Patient tab. Within 3.5s, the patient's tracker automatically shows the yellow delay banner and increased wait time without refreshing! |
| **5. Advance Queue** | In Staff Console, click **"Complete Token GEN-101"** (choose 8 mins), then click **"Call Next Patient"**. | Demonstrates live state transition: Token GEN-102 enters consultation, and the Demo Patient is now next in line (0 patients ahead). |
| **6. ETA Engine Learning** | In Staff Console, click **"ETA Engine Insights"**. | Show the side-by-side comparison between the naive department baseline and QueueCare's adaptive EWMA model, and explain how completed consultations update the pace. |
| **7. Reset Demo** | Click **"Reset Demo"** in the top bar. | Restores the clean initial demonstration state in 1 second. |

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router v6.
- **Backend**: Node.js, Express, TypeScript, REST API, Zod.
- **Database**: SQLite (`better-sqlite3`) with WAL mode and foreign keys enabled.
- **Testing**: Vitest for unit & integration test suites.
- **State Sync**: Lightweight interval polling (3.5s) for responsive near-realtime coordination across tabs.

For in-depth architecture explanations and viva answers, see [`PROJECT_GUIDE.md`](./PROJECT_GUIDE.md).
