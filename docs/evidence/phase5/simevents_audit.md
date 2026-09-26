# Phase 5 — SimEvents Operational Digital Twin Audit

## 1. Forensic Baseline & Legacy Scaffold Audit

An inspection of the pre-existing model `model/telemedicine_screening_system.slx` and associated scripts was conducted using MATLAB R2026a programmatic introspection.

### Legacy Model Findings:
* **Block Diagram Structure**: Contained 10–12 top-level Simulink blocks named with entity-like labels (`AI Inference`, `AI Queue`, `Auto-Approve Sink`, `Patient Arrival`, `Referral Sink`, `Risk Routing`, `Specialist Queue`, `Specialist Review`, `Upload & Compression`, `Upload Queue`).
* **Block Types**: The blocks were standard continuous/discrete Simulink blocks (`UniformRandomNumber`, `UnitDelay`, `Gain`, `Scope`) or empty pass-through subsystems.
* **SimEvents Library Links**: **0** (`find_system(mdl, 'FollowLinks', 'on', 'RegExp', 'on', 'Library', 'simevents')` returned 0).
* **SimEvents Mask Types**: **0** (`Entity Generator: 0`, `Entity Queue: 0`, `Entity Server: 0`, `Entity Output Switch: 0`, `Entity Terminator: 0`).
* **Analytical vs Event Execution**: The existing script `runScalabilityScenario.m` executed closed-form algebraic equations without calling `sim()` or generating discrete events.

### Conclusion on Legacy Model:
The legacy model was a **visual signal-flow scaffold** rather than a functioning discrete-event simulation. In accordance with Phase 5 Part A (Option B), the legacy model is preserved untouched for forensic history, and a new, genuine discrete-event digital twin has been constructed at `model/netracare_simevents_operational.slx`.

---

## 2. New Genuine SimEvents Model Audit

### Model File:
`model/netracare_simevents_operational.slx`

### Environment:
* **MATLAB Release**: `26.1.0.3346908 (R2026a) Update 5`
* **SimEvents Library**: `sldelib` (SimEvents Discrete-Event Library)
* **SimEvents License**: Verified (`license('test', 'SIMEVENTS') == 1`)
* **Simulink License**: Verified (`license('test', 'SIMULINK') == 1`)

### Block Inventory & Verified Discrete-Event Components:

| Block Name | Block Type | Library Source | Function |
| :--- | :--- | :--- | :--- |
| `Patient_Arrival` | `Entity Generator` | `sldelib/Entity Generator` | Generates patient entities carrying structured `PatientBus` attributes |
| `Acquisition_InSwitch` | `Entity Input Switch` | `sldelib/Entity Input Switch` | Merges new patient arrivals with recaptured patient entities |
| `Acquisition_Queue` | `Entity Queue` | `sldelib/Entity Queue` | Infinite capacity FIFO buffer for image acquisition |
| `Acquisition_Server` | `Entity Server` | `sldelib/Entity Server` | Models 120s image capture service & probabilistic quality outcome |
| `Quality_Switch` | `Entity Output Switch` | `sldelib/Entity Output Switch` | Routes Good/Borderline (Port 1) to Compression; Ungradable (Port 2) to Recapture |
| `Recapture_Delay` | `Entity Server` | `sldelib/Entity Server` | Models 30s patient realignment & retake delay |
| `Compression_Server` | `Entity Server` | `sldelib/Entity Server` | Models 1.5s image resizing/JPEG compression & network availability check |
| `Network_Switch` | `Entity Output Switch` | `sldelib/Entity Output Switch` | Routes Online entities directly (Port 1); Offline entities to Store-and-Forward (Port 2) |
| `SF_InSwitch` | `Entity Input Switch` | `sldelib/Entity Input Switch` | Manages store-and-forward incoming buffer |
| `Store_Forward_Queue` | `Entity Queue` | `sldelib/Entity Queue` | Holds queued images when rural connectivity is disconnected |
| `SF_Retry_Server` | `Entity Server` | `sldelib/Entity Server` | Polling retry server testing connectivity restoration |
| `SF_Check_Switch` | `Entity Output Switch` | `sldelib/Entity Output Switch` | Drains restored entities into transmission; re-queues if still disconnected |
| `Net_Tx_InSwitch` | `Entity Input Switch` | `sldelib/Entity Input Switch` | Merges direct online transmissions and drained store-and-forward images |
| `Network_Transmission_Server` | `Entity Server` | `sldelib/Entity Server` | Models 3.5s network payload transfer delay |
| `AI_Queue` | `Entity Queue` | `sldelib/Entity Queue` | Pre-inference queue for AI service |
| `AI_Dispatcher_Switch` | `Entity Output Switch` | `sldelib/Entity Output Switch` | First-not-blocked dispatcher distributing across scalable AI server pool |
| `AI_Server_1` .. `4` | `Entity Server` | `sldelib/Entity Server` | Parallel AI workers executing calibrated 5.3s inference & DR grading |
| `AI_Collector_InSwitch` | `Entity Input Switch` | `sldelib/Entity Input Switch` | Merges outputs from scalable AI server pool |
| `Decision_Switch` | `Entity Output Switch` | `sldelib/Entity Output Switch` | 3-way routing: Auto-Approve (Port 1), Human Review (Port 2), Specialist Referral (Port 3) |
| `Sink_AutoApprove_Complete` | `Entity Terminator` | `sldelib/Entity Terminator` | Sink for completed normal / mild DR screenings |
| `Human_Review_Queue` | `Entity Queue` | `sldelib/Entity Queue` | Queue for medical officer clinical reviews |
| `Human_Reviewer_Server` | `Entity Server` | `sldelib/Entity Server` | Models 180s MO review & secondary specialist escalation |
| `Review_Decision_Switch` | `Entity Output Switch` | `sldelib/Entity Output Switch` | Routes MO Approved (Port 1) or Specialist Escalation (Port 2) |
| `Sink_Review_Complete` | `Entity Terminator` | `sldelib/Entity Terminator` | Sink for completed human-reviewed screenings |
| `Specialist_InSwitch` | `Entity Input Switch` | `sldelib/Entity Input Switch` | Merges direct AI high-risk referrals with MO escalated cases |
| `Specialist_Queue` | `Entity Queue` | `sldelib/Entity Queue` | Queue for tele-ophthalmology specialist reviews |
| `Specialist_Server` | `Entity Server` | `sldelib/Entity Server` | Models 300s tele-ophthalmologist evaluation |
| `Sink_Specialist_Complete` | `Entity Terminator` | `sldelib/Entity Terminator` | Sink for completed specialist referral consultations |

---

## 3. Comparison Matrix

| Dimension | Old Model (`telemedicine_screening_system.slx`) | New Model (`netracare_simevents_operational.slx`) |
| :--- | :--- | :--- |
| **Model Type** | Continuous / Signal-Flow Scaffold | Discrete-Event Simulation |
| **SimEvents Blocks** | 0 | 28 genuine `sldelib` blocks |
| **Entity Representation** | None (continuous pseudo-random signal) | Structured `Simulink.Bus` (`PatientBus`) |
| **Recapture Handling** | None | True event loop with max retry limit & realignment delay |
| **Rural Network Model** | Static Gain block | Configurable intermittent connectivity + Store-and-Forward queue |
| **AI Processing** | Empty subsystem pass-through | Scalable 1–4 unit server pool with Phase 4 calibrated timings |
| **Multi-Stage Decision** | Single static sum | 3-way clinical branching + secondary MO review escalation |
| **Metrics Collection** | Continuous scope block | Discrete event statistics (utilization, departures, queues, throughput) |
| **Execution Verification** | Analytical calculation only | True `sim()` execution producing numerical timeseries evidence |
