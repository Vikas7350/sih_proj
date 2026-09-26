# NetraCare SimEvents Operational Digital Twin — Model Architecture

## 1. System Topology Overview

The NetraCare Operational Digital Twin models the end-to-end discrete-event screening workflow across Primary Health Centers (PHCs), rural connectivity links, AI inference engines, and tertiary referral networks.

```text
┌────────────────────────────────────────────────────────┐
│ 1. PATIENT ARRIVAL (Entity Generator)                  │
│    - Generation: Time-based exponential / deterministic│
│    - Entity Schema: Simulink.Bus (PatientBus)          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐◄──────────────┐ (Recapture Loop)
│ 2. IMAGE ACQUISITION                                   │               │
│    - Acquisition_InSwitch: Merges arrivals & recaptures│               │
│    - Acquisition_Queue: FIFO queue                     │               │
│    - Acquisition_Server: 120s image capture service    │               │
└───────────────────────────┬────────────────────────────┘               │
                            │                                            │
                            ▼                                            │
┌────────────────────────────────────────────────────────┐               │
│ 3. QUALITY ASSESSMENT & RECAPTURE                      │               │
│    - Quality_Switch: 82% Good, 10% Borderline, 8% Ungr │               │
│    - Recapture_Delay: 30s patient realignment          ├───────────────┘
└───────────────────────────┬────────────────────────────┘ (Max 2 Retries)
                            │ Good / Borderline
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. COMPRESSION & PREPARATION                           │
│    - Compression_Server: 1.5s resizing & JPEG payload  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐  Offline
│ 5. NETWORK & STORE-AND-FORWARD                         ├──────────────► Store_Forward_Queue
│    - Network_Switch: Direct vs Store-and-Forward       │                      │
│    - SF_Retry_Server: 5s polling link check            │◄─────────────────────┘
│    - Net_Tx_InSwitch: Merges online & drained streams  │ (when link restored)
│    - Network_Transmission_Server: 3.5s payload transfer│
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 6. AI PROCESSING QUEUE & SCALABLE WORKER POOL          │
│    - AI_Queue: Pre-inference FIFO queue                │
│    - AI_Dispatcher_Switch: First-not-blocked balancer  │
│    - AI_Server_1 .. 4: 5.3s calibrated runtime         │
│    - AI_Collector_InSwitch: Output collector           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 7. CLINICAL DECISION ROUTING                           │
│    - Decision_Switch: 3-way branching                  │
└───────┬───────────────────┼───────────────────┬────────┘
        │                   │                   │
        │ Auto-Approve      │ Human Review      │ Specialist Referral
        │ (70% G0 + 12% G1) │ (10% G2)          │ (8% G3/G4)
        ▼                   ▼                   ▼
┌───────────────┐  ┌──────────────────┐  ┌───────────────────────┐
│ 8. AUTO-      │  │ 9. HUMAN REVIEW  │  │ 10. SPECIALIST        │
│ APPROVE SINK  │  │    Queue + Server│  │     REFERRAL          │
│ Completed     │  │    (180s MO rev) │  │     Queue + Server    │
│ Screenings    │  └────────┬─────────┘  │     (300s tele-ophth) │
└───────────────┘           │            └───────────┬───────────┘
                    Escalate│ 30%                    │
                    ────────┼────────────────────────►
                            │ 70% MO Approved        │
                            ▼                        ▼
                   ┌──────────────────┐  ┌───────────────────────┐
                   │ Review Completed │  │ Specialist Consultation│
                   │ Sink             │  │ Completed Sink        │
                   └──────────────────┘  └───────────────────────┘
```

---

## 2. Patient Entity Data Contract (`Simulink.Bus: PatientBus`)

Each entity flowing through the discrete-event simulation carries 17 structured attributes:

```matlab
PatientBus Attributes:
1.  patient_id              (double): Sequential unique patient identifier from entitySys.id.
2.  arrival_time            (double): Simulation clock timestamp at entity generation.
3.  screening_type          (double): 1 = Routine PHC screening, 2 = High-risk camp.
4.  image_quality           (double): 1 = Good, 2 = Borderline (enhanced), 3 = Ungradable.
5.  recapture_count         (double): Integer count of recapture attempts (max 2).
6.  network_state           (double): 1 = Online, 0 = Offline.
7.  image_size              (double): Compressed payload size (450 KB).
8.  processing_class        (double): 1 = Standard, 2 = Enhanced, 3 = High-res.
9.  dr_grade                (double): 0 = No DR, 1 = Mild, 2 = Moderate, 3 = Severe, 4 = PDR.
10. referable               (double): 0 = Non-referable, 1 = Referable.
11. requires_human_review   (double): 0 = No, 1 = Flagged for Medical Officer.
12. requires_specialist     (double): 0 = No, 1 = Flagged for Specialist Doctor.
13. route_quality           (double): Quality switch control (1 = Pass, 2 = Recapture).
14. route_network           (double): Network switch control (1 = Direct AI, 2 = Store-and-Forward).
15. route_decision          (double): Clinical decision control (1 = Auto-Approve, 2 = MO Review, 3 = Specialist).
16. route_review            (double): Review decision control (1 = MO Complete, 2 = Specialist Escalation).
17. completion_time         (double): Simulation clock timestamp at sink departure.
```

---

## 3. Calibrated Service-Time Model (Phase 4 Evidence Integration)

The operational digital twin abstracts the computational runtime of the verified Phase 4 clinical pipeline (`Matlab/runPipeline.m`) using empirical evidence recorded in `docs/evidence/phase4/runtime_summary.json`:

* **Stage 0 Fundus Validation**: ~0.114 seconds
* **Stage 1 Quality Assessment**: ~0.047 seconds
* **Stage 2 Adaptive Enhancement**: ~0.047 seconds
* **Stage 3 Model Inference**: ~0.249 seconds
* **Grad-CAM Saliency Generation**: ~1.497 seconds
* **Typical Sub-640px Pipeline Execution**: ~5.26 seconds
* **Full 1920×1920 Retinal Vessel Segmentation Pipeline**: ~65.90 seconds (up to 96.56s)
* **Non-Fundus Input Rejection**: ~1.448 seconds

In scale simulation mode, `meanAIServiceTime` is calibrated to **5.3 seconds**, allowing discrete-event modeling of district-scale populations (100,000+ entities) without the impractical computational overhead of executing deep neural networks 100,000 times.

---

## 4. Scenarios Implemented

1. **Baseline**: Standard PHC screening (8h shift, 450s inter-arrival, 1 AI unit, always online).
2. **Rural Connectivity**: Intermittent network with 50% online probability and 5s polling Store-and-Forward retry queue.
3. **High Load**: Congested screening camp (120s inter-arrival, 1 AI unit).
4. **AI Capacity Scaling**: Comparison of 1, 2, and 4 parallel AI processing units under high arrival rate.
5. **Specialist Bottleneck**: High referral volume with constrained specialist service time (600s).
6. **Mass Screening**: 24-hour high-throughput drive (8,641 patient arrivals).
7. **Scale Stress Test**: 150,000 discrete entities generated and processed in 84.1 seconds.
8. **Reproducibility Test**: Exact identical metrics verified under fixed random seed `rng(42)`.
