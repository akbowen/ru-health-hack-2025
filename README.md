# CliniJoy AI — Intelligent Telemedicine Shift Optimization System

[![License: MIT](https://img.shields.io/badge/License-MIT-green)](https://opensource.org/licenses/MIT)
[![Frontend](https://img.shields.io/badge/Frontend-React%2BTypeScript-yellow)](https://reactjs.org/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%2BExpress-blue)](https://expressjs.com/)

A full-stack AI-driven telemedicine scheduling platform that automates provider assignment, predicts patient demand, and enables real-time rescheduling across multiple hospitals. Built with React, Express, Flask, and Google OR-Tools, it ensures fairness, compliance, and operational efficiency.

![Dashboard GIF](./assets/dashboard-demo.gif)
*Example: Sample Dashboard – Interactive schedule and analytics.*

---

## Overview

**CliniJoy AI** integrates data-driven scheduling with optimization algorithms and predictive analytics.

It unites three coordinated layers:

* **Frontend:** Interactive interface (React + Tailwind CSS)
* **Backend:** REST API (Node.js + Express + SQLite)
* **Scheduling Engine:** Optimization and forecasting (Flask + Python + Google OR-Tools)

---

## Core Features

### Doctor Portal

* **Leave Request Workflow:** Doctors can submit leave requests; managers can approve or reject them. Approved leaves automatically trigger open-shift alerts to eligible doctors.
* **Interactive Calendar:** View, export (PDF), or sync the schedule to Google Calendar.
* **Chatbot Assistant:** Provides quick access to information such as upcoming shifts, hospitals, and shift timings.


### Hospital Manager Dashboard

* Approve or reject leave requests.
* Manage facility-specific doctor schedules.
* Receive notifications for open or unfilled shifts.

### Admin Dashboard

* Upload five Excel inputs to generate optimized schedules:

  1. Provider Availability
  2. Provider Contract
  3. Provider Credentialing
  4. Facility Volume
  5. Facility Coverage
* Filter schedules by doctor, hospital, or shift type.
* Upload reports for shift summary, volume tracking, and contract compliance.

### Personalized Analytics

Each doctor receives a Satisfaction Score based on:

* Workload balance
* Weekend versus weekday ratio
* Consecutive-shift compliance
* Contract adherence
* Personal feedback rating

Example insight: *“Your weekend shift ratio is higher than ideal — consider requesting redistribution.”*

---

## Algorithm Architecture

### Stage 1 — Constraint Optimization (CP-SAT)

Formulates a Mixed Integer Programming (MIP) model to maximize facility coverage while enforcing:

* Credential compliance
* Contract limits
* Daily working hour limits (≤ 12 hours)
* Consecutive and weekend shift restrictions

### Stage 2 — Greedy Post-Processing

| Function            | Objective                         | Strategy                             |
| ------------------- | --------------------------------- | ------------------------------------ |
| `phase2_minimize()` | Reduce number of unique providers | Consolidate workloads                |
| `phase2_balanced()` | Evenly distribute shifts          | Prioritize under-scheduled providers |

The best result is chosen based on a Satisfaction Score evaluating fairness and compliance.

Read more in [algorithms folder](https://github.com/akbowen/ru-health-hack-2025/algorithms)

---

## Forecasting Module (Flask Service)

A proof-of-concept Holt-Winters exponential smoothing model predicts next-week telehealth demand.

**Workflow**

1. Retrieve hospital-capacity data from the CDC HHS Protect API.
2. Decompose into level and trend components.
3. Forecast percentage change in ICU occupancy.
4. Adjust expected consult volume dynamically:

```
Adjusted Volume = Baseline × (1 + Predicted % Change)
```

Example: Baseline 200 consults + 1.8% forecast = 203.6 consults allocated.
This creates a feedback loop between real-world demand and automated scheduling.

---

## Tech Stack

| Category                       | Technology                              |
| ------------------------------ | --------------------------------------- |
| **Frontend**                   | React, TypeScript, Tailwind CSS         |
| **Backend**                    | Node.js, Express.js, SQLite             |
| **Scheduling Engine**          | Python, Flask, Google OR-Tools          |
| **Infrastructure**             | AWS (Deployment & Hosting)              |
| **Optimization & Forecasting** | CP-SAT, Greedy Heuristics, Holt-Winters |
| **Version Control**            | Git, GitHub                             |

---

## Project Structure

```
RU-HEALTH-HACK-2025/
│
├── backend/
│   ├── data/
│   │   ├── complete-schedule-data-2025-10.txt
│   │   └── data.sqlite
│   ├── src/index.ts
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Calendar.tsx
│   │   │   ├── LeaveRequestForm.tsx
│   │   │   ├── PhysicianAnalytics.tsx
│   │   │   ├── ScheduleChatbot.tsx
│   │   │   └── UserManagement.tsx
│   │   ├── utils/
│   │   │   ├── api.ts
│   │   │   └── excelParser.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
│
├── sample-data/
│   ├── Provider Availability.xlsx
│   ├── Provider Contract.xlsx
│   ├── Provider Credentialing.xlsx
│   ├── Facility Volume.xlsx
│   ├── Facility Coverage.xlsx
│   └── output/
│
├── flask/
│   └── app.py
│
└── README.md
```

---

## How to Run the Application

### Frontend (React)

```bash
cd frontend
npm i
npm start
```

Runs on **[http://localhost:3000](http://localhost:3000)**

### Backend (Express API)

```bash
cd backend
npm i
npm run seed     # Seed database
npm run start    # Start server
```

Runs on **[http://localhost:5000](http://localhost:5000)**

### Scheduling Engine (Flask)

```bash
cd flask
python app.py
```

Executes the Google OR-Tools scheduling pipeline and forecast logic.

---

## Database Access (SQLite)

* **Path:** `backend/data/data.sqlite`
* **To view in DBeaver:**

  1. Create a new SQLite connection
  2. Select `backend/data/data.sqlite` and connect

---

## Future Scope — Project Intelligence

### Idea 1 — Demand Forecasting via Predictive AI

Integrate historical consult volume, seasonal trends, and hospital census data.
Use Prophet, LSTM, or ARIMA models to forecast future shift demand.
The scheduler can pre-allocate physicians proactively during spikes (e.g., flu season, holidays).
**Impact:** Proactive staffing reduces emergency shortages and improves patient response times.

### Idea 2 — Dynamic Re-Scheduling with Real-Time Feedback

Link the scheduler with telemedicine APIs (e.g., Zoom Health, Amwell) or hospital EHRs.
Adjust assignments live when providers become unavailable or demand surges.
Apply reinforcement learning (RL) for continuous schedule optimization.
**Impact:** Evolves from static scheduling to continuous optimization.

### Idea 3 — Unified Command Dashboard

Develop an advanced admin interface with:

* Calendar visualization
* Coverage heatmaps by facility and shift
* “What-if” simulator for adding or removing providers
  **Impact:** Streamlined operational control and strategic oversight for telehealth scheduling.

---

## Contributors

| Name                   | Responsibilities                                                  |
| ---------------------- | ----------------------------------------------------------------- |
| **Andrew**             | UI implementation and database integration                        |
| **Kevin**              | Doctor Leave System, Chatbot, Analytics Engine                    |
| **Mandar Bavdane**     | UI Integration, API Debugging, Git Management, Presentation       |
| **Sanjavan & William** | Optimization Algorithm, Forecasting Module, CP-SAT + Greedy Logic
| **Dev Desai**          | System integration and optimization; forecasting and scheduling algorithm routing and management.|

---

## License

Licensed under the **MIT License** — free to use, modify, and distribute.

---



