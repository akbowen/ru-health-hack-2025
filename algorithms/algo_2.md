# 🏥 Doctor Scheduling Optimization Algorithm 2

> **A two-phase hybrid optimization framework for automated telemedicine provider scheduling**, combining **Mixed Integer Linear Programming (MILP)** and **heuristic refinement** to maximize coverage while maintaining fairness and contract compliance.

---

## 🧭 Overview

This system constructs optimized weekly or monthly provider schedules across multiple facilities.  
It integrates two complementary optimization methods:

1. **Phase 1 — Mathematical Optimization (MIP)**  
   Uses **Mixed Integer Linear Programming (MILP)** via **Google OR-Tools CP-SAT Solver** to maximize coverage under strict (hard) constraints.

2. **Phase 2 — Heuristic Refinement**  
   Applies a greedy heuristic algorithm to assign remaining unfilled shifts and improve workload balance or efficiency.

---

## ⚙️ Phase 1: Constraint-Based Optimization (MILP)

### Sets and Variables

Let:

- \( F \): set of facilities  
- \( S \): set of shifts (e.g., `MD1`, `MD2`, `PM`)  
- \( P \): set of providers  
- \( D \): set of days  

Define the binary decision variable:

$$
x_{f,s,p,d} =
\begin{cases}
1 & \text{if provider } p \text{ is assigned to shift } s \text{ at facility } f \text{ on day } d, \\
0 & \text{otherwise.}
\end{cases}
$$

---

### Objective Function

The main objective is to **maximize total shift coverage**:

$$
\max Z = \sum_{d \in D} \sum_{f \in F} \sum_{s \in S} \sum_{p \in P} x_{f,s,p,d}
$$

If different shifts have priority or demand weights \( w_{f,s,d} \):

$$
\max Z = \sum_{d \in D} \sum_{f \in F} \sum_{s \in S} \sum_{p \in P} w_{f,s,d} \cdot x_{f,s,p,d}
$$

---

### Constraints

#### 1. Coverage Constraint

Each shift at each facility and day must be covered by exactly one provider:

$$
\sum_{p \in P} x_{f,s,p,d} = 1 \quad \forall f \in F, \; s \in S, \; d \in D
$$

---

#### 2. Credentialing Constraint

A provider can only be assigned where they are credentialed:

$$
x_{f,s,p,d} = 0 \quad \text{if provider } p \text{ is not credentialed at facility } f
$$

---

#### 3. Daily Hour Limit

No provider may exceed their daily working hour cap \( H^{\max}_p \):

$$
\sum_{f \in F} \sum_{s \in S} H_s \cdot x_{f,s,p,d} \leq H^{\max}_p \quad \forall p \in P, \; d \in D
$$

---

#### 4. Weekend Assignment Limit

Each provider has a contractual weekend limit \( W_p \):

$$
\sum_{d \in D_{\text{weekend}}} \sum_{f \in F} \sum_{s \in S} x_{f,s,p,d} \leq W_p \quad \forall p \in P
$$

---

#### 5. Consecutive Shift Restriction

If a provider works a `PM` shift on day \( d \), they cannot be scheduled for an `MD1` shift on day \( d+1 \):

$$
\sum_{f \in F} x_{f,\text{PM},p,d} + \sum_{f' \in F} x_{f',\text{MD1},p,d+1} \leq 1 \quad \forall p \in P, \; d, d+1 \in D
$$

### 🧮 MILP Summary

| **Type** | **Description** |
|-----------|----------------|
| **Variable** | \( x_{f,s,p,d} \in \{0,1\} \) — provider assignment |
| **Objective** | Maximize total filled shifts |
| **Constraints** | Coverage, credentialing, hour limits, weekend cap, consecutive restriction |
| **Solver** | OR-Tools CP-SAT |

---

## 🧮 Phase 2: Heuristic Refinement

After the MILP phase, some shifts may remain unfilled due to infeasibility.  
Phase 2 applies **greedy algorithms** to fill those gaps under two modes:

- **Phase2_Minimize** — minimize the number of distinct providers (*efficiency mode*)  
- **Phase2_Balanced** — equalize workload among providers (*fairness mode*)

---

### 🔸 a. Phase2_Minimize — Efficiency Focus

This mode prioritizes **provider consolidation**, assigning unfilled shifts to already-active providers.

For each uncovered shift \( (f, s, d) \):

#### Step 1: Identify eligible providers

$$
E(f, s, d) = \{ p \in P \mid \text{credentialed}(p, f) \land \text{available}(p, s, d) \}
$$

#### Step 2: Compute a score for each eligible provider

$$
\text{Score}(p) = \alpha \cdot \text{facility\_match}(p, f) + \beta \cdot \text{continuity}(p, s, d)
$$

#### Step 3: Choose the best provider

$$
p^* = \arg\max_{p \in E(f,s,d)} \text{Score}(p)
$$

Assign \( p^* \) to shift \( (f, s, d) \).

where \( \alpha, \beta \in [0, 1] \) are tunable coefficients.

✅ **Goal:** Minimize fragmentation and operational cost by assigning shifts to already-active providers.

---

### 🔸 b. Phase2_Balanced — Fairness Focus

This mode distributes remaining workload **as evenly as possible** among providers.

For each uncovered shift \( (f, s, d) \):

#### Step 1: Identify eligible providers

$$
E(f, s, d) = \{ p \in P \mid \text{credentialed}(p, f) \land \text{available}(p, s, d) \}
$$

#### Step 2: Compute a fairness score

$$
\text{Score}(p) = \frac{1}{1 + Np} + \gamma \cdot \text{continuity}(p, s, d)
$$

where \( Np \) is the total number of shifts already assigned to provider \( p \).

#### Step 3: Select the best provider

$$
p^* = \arg\max_{p \in E(f,s,d)} \text{Score}(p)
$$

✅ **Goal:** Promote fairness and workload balance while maintaining shift continuity.

---

## 📊 Satisfaction Scoring

After both Phase 2 modes are executed, the system computes a **satisfaction score** to evaluate overall schedule quality:

$$
S = w_1 \cdot V_{\text{total}} + w_2 \cdot V_{\text{PM}} + w_3 \cdot V_{\text{weekend}}
$$

Where:

- \( v_total \): total contractual violations  
- \( V_PM \): excess PM shifts  
- \( V_weekend \): weekend over-allocations  
- \( w_1 < w_2 < w_3 \): penalty weights emphasizing fairness

✅ The schedule with the **lowest** \( S \) is selected as the **final optimized solution**.



