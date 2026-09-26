function resultsTable = runScalabilityExperiments(outputDir)
%RUNSCALABILITYEXPERIMENTS Run load and connectivity stress scenarios.
% Results are engineering simulations, not evidence of deployed capacity.

if nargin < 1 || isempty(outputDir)
    outputDir = fullfile('results', 'simulink');
end
if ~exist(outputDir, 'dir')
    mkdir(outputDir);
end

parameters = defaultTelemedicineParameters();
loadRates = [10 25 50 100 200];
rows = struct('scenario', {}, 'arrival_rate_per_hour', {}, ...
    'throughput_per_hour', {}, 'average_latency_seconds', {}, ...
    'max_queue_length_estimate', {}, 'specialist_utilization', {}, ...
    'ai_utilization', {}, 'network_utilization', {}, ...
    'failed_transmissions', {}, 'bottleneck', {});
rowIndex = 0;

for index = 1:numel(parameters.SCENARIOS)
    for rateIndex = 1:numel(loadRates)
        scenarioParameters = parameters;
        scenarioParameters.SCENARIOS(index).arrival_rate = loadRates(rateIndex);
        result = runScalabilityScenario(scenarioParameters, index);
        rowIndex = rowIndex + 1;
        rows(rowIndex).scenario = result.scenario;
        rows(rowIndex).arrival_rate_per_hour = result.arrival_rate_per_hour;
        rows(rowIndex).throughput_per_hour = result.throughput_per_hour;
        rows(rowIndex).average_latency_seconds = result.average_latency_seconds;
        rows(rowIndex).max_queue_length_estimate = result.max_queue_length_estimate;
        rows(rowIndex).specialist_utilization = result.specialist_utilization;
        rows(rowIndex).ai_utilization = result.ai_utilization;
        rows(rowIndex).network_utilization = result.network_utilization;
        rows(rowIndex).failed_transmissions = result.failed_transmissions;
        rows(rowIndex).bottleneck = result.bottleneck;
    end
end

resultsTable = struct2table(rows);
writetable(resultsTable, fullfile(outputDir, 'scalability_results.csv'));

figure('Visible', 'off');
groups = unique(resultsTable.scenario, 'stable');
for index = 1:numel(groups)
    subplot(2, 2, index);
    rowsForScenario = strcmp(resultsTable.scenario, groups{index});
    plot(resultsTable.arrival_rate_per_hour(rowsForScenario), ...
        resultsTable.max_queue_length_estimate(rowsForScenario), '-o');
    title(strrep(groups{index}, '_', ' '));
    xlabel('Patients per hour');
    ylabel('Estimated maximum queue');
    grid on;
end
saveas(gcf, fullfile(outputDir, 'queue_stress_test.png'));
close(gcf);
end
