function results = runScalabilityScenario(parameters, scenarioIndex)
%RUNSCALABILITYSCENARIO Estimate workload bottlenecks for design scenarios.
% This lightweight fallback is useful for parameter sweeps; Simulink remains
% the system-level model of record when the generated model is available.

if nargin < 1 || isempty(parameters)
    parameters = defaultTelemedicineParameters();
end
if nargin < 2
    scenarioIndex = 1;
end

scenario = parameters.SCENARIOS(scenarioIndex);
arrivalRate = scenario.arrival_rate;
hours = parameters.SIMULATION_HOURS;
patients = round(arrivalRate * hours);

compressedMb = parameters.IMAGE_SIZE_MB * parameters.COMPRESSION_RATIO;
networkCapacity = scenario.bandwidth_mbps * 3600 / 8;
networkSeconds = compressedMb / (scenario.bandwidth_mbps / 8) + ...
    parameters.NETWORK_LATENCY_MS / 1000;
aiCapacity = 3600 / (parameters.QUALITY_CHECK_TIME + ...
    parameters.AI_INFERENCE_TIME + parameters.IMAGE_PROCESSING_TIME);
specialistCapacity = scenario.specialists * 3600 / parameters.SPECIALIST_REVIEW_TIME;

capacity = min([networkCapacity / max(compressedMb, eps), aiCapacity, specialistCapacity]);
utilization = [arrivalRate / (networkCapacity / max(compressedMb, eps)), ...
    arrivalRate / aiCapacity, arrivalRate / specialistCapacity];
queueGrowth = max(0, arrivalRate - capacity) * hours;
failed = min(patients, round(patients * parameters.PACKET_LOSS_RATE));

results = struct();
results.scenario = char(scenario.name);
results.arrival_rate_per_hour = arrivalRate;
results.patients_simulated = patients;
results.network_latency_seconds = networkSeconds;
results.throughput_per_hour = capacity;
results.average_latency_seconds = networkSeconds + ...
    parameters.QUALITY_CHECK_TIME + parameters.AI_INFERENCE_TIME + ...
    parameters.IMAGE_PROCESSING_TIME + parameters.SPECIALIST_REVIEW_TIME;
results.max_queue_length_estimate = min(parameters.MAX_QUEUE_LENGTH, queueGrowth);
results.specialist_utilization = utilization(3);
results.ai_utilization = utilization(2);
results.network_utilization = utilization(1);
results.failed_transmissions = failed;
results.bottleneck = bottleneckName(utilization);
end

function name = bottleneckName(utilization)
[~, index] = max(utilization);
names = {'network', 'ai_processing', 'specialist_review'};
name = names{index};
end
