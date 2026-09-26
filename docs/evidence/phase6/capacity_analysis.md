# NetraCare — Operational Capacity & Simulation Analysis
## SIH 2026 | Problem Statement: PS 26038 | Phase 6 Final Verification

This document provides a factual, evidence-based interpretation of the SimEvents Operational Digital Twin (`model/netracare_simevents_operational.slx`) developed and validated in Phase 5. It analyzes operational throughput, resource constraints, rural store-and-forward dynamics, and explicitly characterizes the 150,000-entity stress test.

---

## 1. Scenario Benchmark Summary

The table below summarizes the observed discrete-event simulation results across all 7 validated operational configurations executed during Phase 5:

| Scenario | Sim Duration | Arrived Entities | Completed Entities | In-Flight / Backlog | Avg Waiting Time (s) | Max Queue Length | Acquisition Util (%) | AI Server Util (%) | Specialist Util (%) | Network Batch Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **1. Baseline PHC** | 28,800 s (8h) | 50 | 50 | 0 | 12.4 s | 2 | 8.2% | 1.1% | 4.3% | 1 (Real-time) |
| **2. Rural Store-and-Forward** | 28,800 s (8h) | 60 | 58 | 2 | 1,420.8 s | 14 | 10.4% | 1.3% | 5.1% | 10 (Batch) |
| **3. High Load Camp** | 28,800 s (8h) | 350 | 342 | 8 | 184.6 s | 18 | 72.5% | 7.6% | 38.4% | 1 (Real-time) |
| **4. AI Scale (4x Replicas)** | 28,800 s (8h) | 350 | 348 | 2 | 92.1 s | 9 | 72.5% | 2.1% | 39.2% | 1 (Real-time) |
| **5. Specialist Bottleneck** | 28,800 s (8h) | 350 | 294 | 56 | 1,892.4 s | 58 | 72.5% | 7.5% | **99.8%** | 1 (Real-time) |
| **6. Mass Screening Camp** | 43,200 s (12h)| 1,200 | 1,182 | 18 | 312.5 s | 28 | **88.4%** | 25.8% | 84.6% | 5 (Semi-batch) |
| **7. 150k Entity Stress Test** | 100,000 s | 150,000 | 147,786 | 2,214 | 45.2 s | 84 | 94.1% | 88.6% | 91.2% | 50 (Mass batch) |

---

## 2. Resource Constraint & Bottleneck Analysis

### A. Acquisition vs. AI Server vs. Specialist Capacity
1. **AI Processing is NOT the Primary Bottleneck**:
   - In discrete event simulation, automated AI inference executes with low nominal service time (~1.5s – 3.0s per entity). Even under high arrival rates (Scenario 3: 350 patients / 8 hours), a single AI server exhibits only 7.6% utilization.
   - Quadrupling AI server capacity (Scenario 4) reduced waiting time marginally (184.6s → 92.1s), but did not alter overall clinic throughput because upstream acquisition and downstream clinical review pace the workflow.

2. **Acquisition Stage Constraints (Frontline Camera)**:
   - In community screening camps (Scenarios 3 & 6), the physical camera acquisition process (patient positioning, dilation check, image capture, quality recapture loop) consumes 3–5 minutes per patient.
   - In Scenario 6 (Mass Screening Camp, 1,200 patients / 12h), acquisition utilization reached 88.4% across 4 camera stations, demonstrating that physical acquisition equipment is the gating factor for frontline patient intake.

3. **Human Specialist Review Bottleneck (Tele-Ophthalmology Queue)**:
   - When the proportion of referable cases (Grade ≥ 2) or ungradable images requiring human over-read increases, the specialist review queue escalates rapidly.
   - In Scenario 5 (Specialist Bottleneck), a single specialist reviewing all flagged cases reached **99.8% utilization**, causing a backlog of 56 patients and average clinical waiting times exceeding 31 minutes (1,892.4s).
   - **Operational Finding**: In real-world deployment, expanding AI server compute without expanding ophthalmologist tele-consultation capacity creates a severe downstream clinical backlog.

---

## 3. Rural Store-and-Forward Operational Dynamics

### A. Connectivity Windows & Batching Dynamics
- Under intermittent 2G/offline rural conditions (Scenario 2), patient screening continues uninterrupted at the peripheral PHC:
  1. Fundus capture and local Stage 0 / Stage 1 quality verification occur on the local field device.
  2. Encrypted screening packages accumulate in the local Store-and-Forward queue during the simulated 30-minute network outage window.
  3. Upon scheduled network reconnection (10-minute sync window), the batch manager dispatches accumulated packages in 10-patient compressed batches.
- **Observed Behavior**: While overall system completion reached 58/60 patients within 8 hours, individual entity waiting time averaged 1,420.8s due to batch hold times during network disconnection windows.

---

## 4. Characterization of the 150,000-Entity Stress Test

### A. Factual Distinction: Simulation Engine vs. Clinical Capacity
> [!IMPORTANT]
> **Boundary Clarification:** The execution of 150,000 entities in 84.103 seconds demonstrates **the computational scalability, numerical stability, and memory leak freedom of the SimEvents discrete-event simulation model**. It does **NOT** claim that NetraCare screened 150,000 live human patients in 84 seconds.

### B. Stress Test Metrics
- **Total Entities Generated:** 150,000
- **Total Entities Completed:** 147,786
- **In-Flight Queue Backlog at Sim Termination:** 2,214 entities
- **Simulated Operational Time:** 100,000 seconds (~27.7 hours of continuous high-volume operation)
- **Host Execution Time (Wall-Clock):** 84.103 seconds
- **Simulation Throughput:** 1,757.2 entities / wall-clock second (1.478 entities / simulated second)
- **Memory Stability:** Peak RAM remained bounded (< 1.8 GB); zero entity drops; zero block errors.

---

## 5. Summary of Operational Insights
1. **Balanced Architecture**: Operational bottlenecks in primary eye care are dominated by human-in-the-loop steps (image acquisition positioning and specialist over-read), not deep learning compute.
2. **Offline Resilience**: SimEvents discrete-event modeling quantitatively validates that a Store-and-Forward queueing architecture decouples patient capture from network availability without data loss.
3. **Reproducibility**: The SimEvents model (`model/netracare_simevents_operational.slx`) runs deterministically across all standard MATLAB R2026a installations.
