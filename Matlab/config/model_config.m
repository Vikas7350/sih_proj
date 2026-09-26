function cfg = model_config()
% MODEL_CONFIG Configuration parameters for NetraCare Clinical AI Workstream
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Central configuration definition for fundus image quality assessment,
%   enhancement, diabetic retinopathy (DR) classification with EfficientNet-B0,
%   and Explainable AI (Grad-CAM) pipelines.
%
% Outputs:
%   cfg - Struct containing pipeline configurations and directory paths
%
% Reference:
%   Matches Python PyTorch EfficientNet-B0 inference pipeline (RentoAI backend).

    %% Project Metadata
    cfg = struct();
    cfg.project.name = 'NetraCare';
    cfg.project.sih_id = 'SIH26038';
    cfg.project.title = 'Explainable AI for Diabetic Retinopathy Screening';
    cfg.project.workstream = 'Person A — AI/MATLAB';
    cfg.project.version = '0.1.0-parity';

    %% Dataset and Directory Paths
    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    cfg.paths.root = projectRoot;
    cfg.paths.raw_data = fullfile(projectRoot, 'data', 'raw');
    cfg.paths.processed_data = fullfile(projectRoot, 'data', 'processed');
    cfg.paths.results = fullfile(projectRoot, 'data', 'results');
    cfg.paths.model_dir = fullfile(projectRoot, 'model');

    %% DR Severity Scale (ICDR Standard - Exact Python Parity Order)
    % 0: No DR
    % 1: Mild DR
    % 2: Moderate DR
    % 3: Severe DR
    % 4: Proliferative DR
    cfg.classes.grades = [0, 1, 2, 3, 4];
    cfg.classes.names = { ...
        'No DR', ...
        'Mild DR', ...
        'Moderate DR', ...
        'Severe DR', ...
        'Proliferative DR' ...
    };
    cfg.classes.referral_threshold = 2; % Moderate DR and above flagged for specialist referral

    %% Input Image Preprocessing (Exact PyTorch torchvision EfficientNet-B0 Specification)
    cfg.image.input_size = [224, 224, 3];
    cfg.image.resize_method = 'bilinear';
    cfg.image.color_order = 'RGB';
    cfg.image.scale_range = [0, 1];
    cfg.image.normalization.mean = [0.485, 0.456, 0.406];
    cfg.image.normalization.std  = [0.229, 0.224, 0.225];
    cfg.image.supported_formats = {'.jpg', '.jpeg', '.png', '.tif', '.tiff'};

    %% Stage 0: Fundus Image Validation Configuration
    cfg.fundus = fundus_config();
    cfg.fundus.enabled = true;

    %% Quality Assessment Configuration
    cfg.quality = quality_config();
    cfg.quality.enabled = true;

    %% Enhancement Configuration
    cfg.enhancement = enhancement_config();
    cfg.enhancement.enabled = true;

    %% Model Architecture Configuration (EfficientNet-B0)
    cfg.model.architecture = 'EfficientNet-B0';
    cfg.model.onnx_file = fullfile(cfg.paths.model_dir, 'netracare_efficientnet_b0.onnx');
    cfg.model.mat_file = fullfile(cfg.paths.model_dir, 'netracare_efficientnet_b0.mat');
    cfg.model.num_classes = numel(cfg.classes.grades);

    %% Version and Reproducibility (Blueprint Section 10)
    cfg.model_version = 'EfficientNet-B0-APTOS-v1';
    cfg.pipeline_version = '0.1.0-parity';

    %% Explainable AI (XAI) Configuration
    cfg.xai.method = 'GradCAM';
    % Imported ONNX layer matching PyTorch model.features[8][0]:
    % head expand Conv2d(320 -> 1280, 1x1), output 7x7x1280 feature map
    % feeding SiLU (371 Sigmoid + 370 Multiply) then GlobalAveragePool.
    cfg.xai.feature_layer = 'x_features_featu_469';
    cfg.xai.reduction_layer = 'x_classifier_classif'; % final FC, matches ONNX output
    cfg.xai.overlay_alpha = 0.30; % Matching Python inference alpha=0.30
    cfg.xai.colormap = 'jet';

end
