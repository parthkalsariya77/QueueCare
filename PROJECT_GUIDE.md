# QueueCare — Project Architecture & Viva Guide

This guide is designed to help students understand, present, and explain the engineering decisions behind QueueCare in the B.Tech Design Thinking Lab evaluation.

---

## 1. System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │                 Client Layer                 │
                  │   React 18 + TypeScript + Vite + Tailwind    │
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
                   [Patient Portal]              [Staff Console]
                   Search & Filter               Queue Operations
                   Token Booking                 Add Delays / Pause
                   Live Queue Tracker            Complete Consultations
                                 │                │
                                 ▼                ▼
                  ┌──────────────────────────────────────────────┐
                  │               Express REST API               │
                  │             (Port 3001 via Vite)             │
                  ├──────────────────────────────────────────────┤
                  │  /api/hospitals     /api/appointments        │
                  │  /api/queues        /api/staff               │
                  └──────────────┬───────────────────────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
        ┌──────────────────────┐    ┌──────────────────────┐
        │     Queue Service    │    │   Adaptive ETA Engine│
        │ - Status transitions │    │ - EWMA (alpha = 0.30)│
        │ - Token generation   │    │ - Department median  │
        │ - Positional updates │    │ - Bayesian smoothing │
        └──────────┬───────────┘    └──────────┬───────────┘
                   │                           │
                   └─────────────┬─────────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │      SQLite Database         │
                  │   (WAL Mode + Foreign Keys)  │
                  └──────────────────────────────┘
```

---

## 2. Relational Database Design

All entities are persistently stored in SQLite (`data/queuecare.db`):

| Table | Primary Role | Key Columns |
|---|---|---|
| **`hospitals`** | Hospital profile & locality | `id, name, locality, city, open_time, close_time, is_open` |
| **`departments`** | Specialties linked to hospital | `id, hospital_id, name, description` |
| **`doctors`** | Practitioners & default baseline | `id, hospital_id, department_id, name, specialization, default_avg_min` |
| **`queues`** | Operational queue per doctor | `id, hospital_id, department_id, doctor_id, status, delay_minutes, delay_reason` |
| **`appointments`** | Bookings, tokens, & queue positions | `id, patient_id, token_number, scheduled_time, status, queue_position, timestamps` |
| **`consultation_history`** | Completed duration observations | `id, doctor_id, department_id, duration_minutes, completed_at, source` |
| **`queue_events`** | Audit log of queue actions | `id, queue_id, event_type, message, created_at` |

---

## 3. Queue State Machine Transitions

Appointments follow strict, validated lifecycle transitions:

```
           [Booked] 
             │   \
             │    └──> [Cancelled] (Patient action)
             │
      (Check-in via reception or mobile)
             │
             ▼
          [Waiting] ──────> [No-Show] (Staff action if patient absent)
             │      \
             │       └───> [Rescheduled] (Re-allocated to another slot)
             │
      (Staff calls next patient)
             │
             ▼
      [In Consultation]
             │
      (Doctor finishes & logs duration)
             │
             ▼
        [Completed] ───> Appends to consultation_history table (Learned)
```

---

## 4. Adaptive ETA Engine — Mathematical Formulation

### A. The Core Problem with Fixed Averages
A naive queue management system estimates waiting time simply as:
$$\text{ETA}_{\text{naive}} = (\text{Patients Ahead}) \times \text{Fixed Standard Duration}$$

This fails in real clinical settings because:
1. Different doctors work at vastly different paces.
2. Individual doctor speed varies over time (e.g. fatigue, complex cases).
3. Old records from months ago are treated with equal weight as cases finished 10 minutes ago.

### B. QueueCare Adaptive Formulation

#### 1. Exponentially Weighted Moving Average (EWMA)
Recent consultations carry more weight than older ones:
$$\text{EWMA}_{\text{new}} = \alpha \times d_{\text{latest}} + (1 - \alpha) \times \text{EWMA}_{\text{prev}}$$
- We use $\alpha = 0.30$.
- The latest completed consultation contributes 30% to the pace estimate, while historical performance retains 70%.

#### 2. Department Median Bayesian Smoothing
When a doctor has very few completed consultations ($n$ is small), relying purely on EWMA causes high variance. We blend the doctor's EWMA with the department median:
$$\text{Weight} = \frac{n}{n + k} \quad (\text{with smoothing constant } k = 5)$$
$$\text{Predicted Duration} = \text{Weight} \times \text{Doctor EWMA} + (1 - \text{Weight}) \times \text{Dept Median}$$

*Behavior:*
- If $n = 0$: Weight is 0% $\rightarrow$ uses Department Median.
- If $n = 5$: Weight is 50% $\rightarrow$ equal blend between Doctor and Department.
- If $n = 20$: Weight is 80% $\rightarrow$ strongly governed by the Doctor's individual pace.

#### 3. Queue-Aware Summation
For a waiting patient at position $P$:
$$\text{ETA} = \max(0, \text{Predicted Duration}_{\text{current}} - \text{Elapsed Time}) + \sum_{i=1}^{\text{patients ahead}} \text{Predicted Duration}_i + \text{Configured Delay}$$

#### 4. Indicative Planning Range
To acknowledge natural consultation variability without giving false precision:
$$\text{Margin} = \sigma \times \sqrt{\text{effective workload count}}$$
$$\text{Range} = [\max(0, \text{ETA} - \text{Margin}), \text{ETA} + \text{Margin}]$$

---

## 5. Frequently Asked Viva Questions

**Q1: Is this machine learning?**
> **Answer:** No, and we are honest about this in our documentation. QueueCare uses an **adaptive, explainable statistical estimator (EWMA + Bayesian smoothing)**. It does not require heavyweight ML infrastructure, GPUs, or external AI APIs, while still learning dynamically from every completed consultation.

**Q2: How do changes made by the staff appear on the patient's screen without refreshing?**
> **Answer:** We implemented a responsive polling mechanism (every 3.5 seconds) on active queue screens. Both the Patient Portal and Hospital Staff Portal communicate with the exact same SQLite database on the Express server. When staff adds a delay or calls a patient, the database updates immediately, and the patient's next polling cycle picks up the authoritative state.

**Q3: How are hospital queue wait times shown during search?**
> **Answer:** When patients search for hospitals, the backend calculates the minimum active queue wait across the hospital's doctors using the live queue formula, giving patients transparent information before choosing where to go.

**Q4: What happens if the queue is paused?**
> **Answer:** When staff pauses a queue (e.g. for emergency rounds), the system freezes misleading countdowns and displays a visible *"Queue Paused"* notice to patients with the staff-provided reason.
