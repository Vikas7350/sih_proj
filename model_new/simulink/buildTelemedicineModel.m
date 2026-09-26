function modelName = buildTelemedicineModel(modelName)
%BUILDTELEMEDICINEMODEL Create the top-level Simulink workflow scaffold.
% Run this function in MATLAB with Simulink installed.

if nargin < 1
    modelName = 'telemedicine_screening_system';
end

parameters = defaultTelemedicineParameters();
if bdIsLoaded(modelName)
    close_system(modelName, 0);
end
new_system(modelName);
open_system(modelName);
modelWorkspace = get_param(modelName, 'ModelWorkspace');
parameterNames = fieldnames(parameters);
for index = 1:numel(parameterNames)
    assignin(modelWorkspace, parameterNames{index}, parameters.(parameterNames{index}));
end

blocks = { ...
    'Patient Source', 'simulink/Sources/Uniform Random Number';
    'Fundus Camera', 'simulink/Ports & Subsystems/Subsystem';
    'Image Acquisition', 'simulink/Ports & Subsystems/Subsystem';
    'Buffer', 'simulink/Discrete/Unit Delay';
    'Compression', 'simulink/Ports & Subsystems/Subsystem';
    'Network', 'simulink/Ports & Subsystems/Subsystem';
    'Quality Gate', 'simulink/Ports & Subsystems/Subsystem';
    'AI Processing', 'simulink/Ports & Subsystems/Subsystem';
    'Risk Routing', 'simulink/Ports & Subsystems/Subsystem';
    'Specialist Queue', 'simulink/Ports & Subsystems/Subsystem';
    'Specialist Review', 'simulink/Ports & Subsystems/Subsystem';
    'Metrics', 'simulink/Sinks/Scope'};

left = 30;
top = 80;
width = 115;
height = 55;
gap = 35;
for index = 1:size(blocks, 1)
    x = left + (index - 1) * (width + gap);
    add_block(blocks{index, 2}, [modelName '/' blocks{index, 1}], ...
        'Position', [x top x + width top + height]);
end

for index = 1:size(blocks, 1) - 1
    add_line(modelName, [blocks{index, 1} '/1'], [blocks{index + 1, 1} '/1'], ...
        'autorouting', 'on');
end

set_param(modelName, 'StopTime', num2str(parameters.SIMULATION_HOURS * 3600));
set_param(modelName, 'SimulationCommand', 'update');
save_system(modelName, [modelName '.slx']);
end
