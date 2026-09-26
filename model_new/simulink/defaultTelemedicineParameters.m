function parameters = defaultTelemedicineParameters()
%DEFAULTTELEMEDICINEPARAMETERS Engineering assumptions for simulation only.

parameters.PATIENT_ARRIVAL_RATE = 27;       % patients/hour baseline
parameters.IMAGE_SIZE_MB = 8;
parameters.IMAGE_RESOLUTION = [2048 1536];
parameters.COMPRESSION_RATIO = 0.35;
parameters.NETWORK_BANDWIDTH_MBPS = 10;
parameters.NETWORK_LATENCY_MS = 150;
parameters.PACKET_LOSS_RATE = 0.01;
parameters.IMAGE_PROCESSING_TIME = 5;      % seconds
parameters.QUALITY_CHECK_TIME = 1;         % seconds
parameters.AI_INFERENCE_TIME = 2;          % seconds
parameters.SPECIALIST_REVIEW_TIME = 180;   % seconds
parameters.NUMBER_OF_SPECIALISTS = 2;
parameters.BUFFER_CAPACITY = 100;
parameters.MAX_QUEUE_LENGTH = 500;
parameters.SIMULATION_HOURS = 10;
parameters.RANDOM_SEED = 42;

parameters.SCENARIOS = struct(...
    'name', {"good_connectivity", "low_bandwidth", ...
        "high_patient_load", "limited_specialists"}, ...
    'arrival_rate', {27, 27, 100, 27}, ...
    'bandwidth_mbps', {25, 1, 10, 10}, ...
    'specialists', {2, 2, 4, 1});
end
