function net = loadModel(modelPath, cfg)
% LOADMODEL Load trained Diabetic Retinopathy classification network
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   net = loadModel()
%   net = loadModel(modelPath, cfg)
%
% Inputs:
%   modelPath - (Optional) Path to saved model weights (.mat or .onnx file)
%   cfg       - (Optional) Configuration struct from model_config()
%
% Outputs:
%   net - Deep learning network object (dlnetwork/DAGNetwork) or structure
%
% Architecture Reference:
%   Torchvision EfficientNet-B0 fine-tuned on APTOS (5-class DR classifier).

    if nargin < 2 || isempty(cfg)
        cfg = model_config();
    end

    if nargin < 1 || isempty(modelPath)
        % Check for pre-imported .mat first, then .onnx
        if isfile(cfg.model.mat_file)
            modelPath = cfg.model.mat_file;
        elseif isfile(cfg.model.onnx_file)
            modelPath = cfg.model.onnx_file;
        else
            modelPath = cfg.model.onnx_file;
        end
    end

    % 1. Load from pre-saved MATLAB .mat file if present
    if endsWith(modelPath, '.mat', 'IgnoreCase', true) && isfile(modelPath)
        loadedData = load(modelPath);
        if isfield(loadedData, 'net')
            net = loadedData.net;
        else
            net = loadedData;
        end
        return;
    end

    % 2. Import from ONNX file
    if endsWith(modelPath, '.onnx', 'IgnoreCase', true) && isfile(modelPath)
        try
            % Check available ONNX import functions in Deep Learning Toolbox
            if exist('importNetworkFromONNX', 'file') == 2 || exist('importNetworkFromONNX', 'builtin') == 5
                net = importNetworkFromONNX(modelPath);
            elseif exist('importONNXNetwork', 'file') == 2 || exist('importONNXNetwork', 'builtin') == 5
                net = importONNXNetwork(modelPath);
            else
                error('loadModel:ToolboxMissing', ...
                    'Neither importNetworkFromONNX nor importONNXNetwork was found in this MATLAB installation.');
            end

            % Optionally cache as .mat for faster subsequent loads
            matCachePath = cfg.model.mat_file;
            try
                save(matCachePath, 'net', '-v7.3');
            catch
                % Best-effort cache save
            end
            return;
        catch ME
            warning('loadModel:ONNXImportFailed', ...
                'Failed to import ONNX model: %s. Returning descriptor struct.', ME.message);
        end
    end

    % 3. Fallback descriptor if weights unavailable or import pending
    net = struct();
    net.is_placeholder = true;
    net.architecture = cfg.model.architecture;
    net.input_size = cfg.image.input_size;
    net.num_classes = cfg.model.num_classes;
    net.classes = cfg.classes.names;
    net.weights_path = modelPath;
    net.status = 'Awaiting MATLAB Deep Learning Toolbox ONNX import execution';

end
