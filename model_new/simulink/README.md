# Simulink Telemedicine Scalability Prototype

This folder defines the system-level telemedicine simulation around the DR model. It is separate from CNN training. The simulation represents patient arrival, image acquisition, buffering, compression, network transfer, quality gating, AI processing, risk routing, and specialist review.

The generated model is `../telemedicine_screening_system.slx`. Run
`buildTelemedicineModel.m` in MATLAB with Simulink to regenerate it after
changing the workflow or parameters.

The annual workload target is a design scenario, not a deployment claim:

```text
100,000 patients/year
approximately 274 patients/day
approximately 27 patients/hour for a 10-hour day
```

The configurable scenarios are:

- Good rural connectivity
- Low-bandwidth rural connectivity
- High patient load
- Limited specialist availability

Use `defaultTelemedicineParameters.m` for assumptions and `buildTelemedicineModel.m` to create the top-level model. Tune the parameters in the Simulink model workspace before running experiments.

Important outputs are throughput, end-to-end latency, queue length, specialist utilization, AI utilization, network utilization, failed transmissions, and the estimated bottleneck.
