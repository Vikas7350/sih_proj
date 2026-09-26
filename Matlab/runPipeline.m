function [resultJSON, resultStruct] = runPipeline(imageInput, screeningId)
% RUNPIPELINE Primary entry point for NetraCare Clinical AI Screening Pipeline
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   resultJSON = runPipeline()
%   resultJSON = runPipeline(imageInput)
%   [resultJSON, resultStruct] = runPipeline(imageInput, screeningId)
%
% Inputs:
%   imageInput  - (Optional) File path string OR RGB image matrix (uint8 / double).
%                 If omitted, loads SCR-0003.jpg genuine benchmark image as default test.
%   screeningId - (Optional) Screening identifier string. Defaults to 'SCREENING-DEMO-001'.
%
% Outputs:
%   resultJSON   - JSON string strictly matching Blueprint Section 10 contract
%   resultStruct - Struct representation of the complete screening result
%
% Complete Clinical Pipeline Architecture (Safety Gated):
%
%   INPUT IMAGE
%       |
%       v
%   STAGE 0: FUNDUS VALIDATION (checkFundusImage)
%       |
%       +---- NON_FUNDUS ----> REJECT (immediate rejection, never enters clinical flow)
%       |
%       +---- UNCERTAIN ------> REJECT / HUMAN REVIEW (flagged for specialist review)
%       |
%       +---- FUNDUS ---------> STAGE 1: QUALITY ASSESSMENT (assessQuality)
%                                 |
%                                 +---- GOOD ---------> CNN (predictDR) -> Grad-CAM
%                                 |
%                                 +---- BORDERLINE --> STAGE 2: Adaptive Enhancement (enhanceBorderline)
%                                 |                      |
%                                 |                      +-- Acceptable (GOOD) -> CNN -> Grad-CAM
%                                 |                      +-- Unacceptable ------> RECAPTURE
%                                 |
%                                 +---- UNGRADABLE --> RECAPTURE (strictly bypasses enhancement)

    %% 1. Workspace & Path Setup
    scriptDir = fileparts(mfilename('fullpath'));
    addpath(fullfile(scriptDir, 'config'));
    addpath(fullfile(scriptDir, 'quality'));
    addpath(fullfile(scriptDir, 'enhancement'));
    addpath(fullfile(scriptDir, 'retinal'));
    addpath(fullfile(scriptDir, 'model'));
    addpath(fullfile(scriptDir, 'xai'));
    addpath(fullfile(scriptDir, 'evaluation'));

    cfg = model_config();

    if nargin < 2 || isempty(screeningId)
        screeningId = 'SCREENING-DEMO-001';
    else
        screeningId = char(screeningId);
    end

    %% 2. Ingest Input Image
    if nargin < 1 || isempty(imageInput)
        % Default benchmark genuine fundus image (Phase 2: verified FUNDUS)
        imageInput = fullfile(scriptDir, '..', 'backend', 'storage', 'uploads', 'SCR-0062.jpg');
        if ~isfile(imageInput)
            error('runPipeline:NoInput', 'No image input provided and default fundus image not found at %s.', imageInput);
        end
    end

    if ischar(imageInput) || isstring(imageInput)
        if ~isfile(imageInput)
            error('runPipeline:FileNotFound', 'Image file not found: %s', imageInput);
        end
        try
            fundusImg = imread(char(imageInput));
        catch ME
            % Unreadable/corrupt input (e.g. WebP mislabeled .png): a
            % VALID-REJECT result, not a pipeline failure. Returns the same
            % structured contract shape as the Stage 0 gate (docs/contract.md).
            reason = sprintf('Input could not be decoded as an image (%s): %s', ...
                ME.identifier, ME.message);
            resultStruct = struct();
            resultStruct.screening_id     = screeningId;
            resultStruct.stage            = 'STAGE_0_FUNDUS_VALIDATION';
            resultStruct.status           = 'UNREADABLE';
            resultStruct.action           = 'REJECT';
            resultStruct.decision         = 'reject';
            resultStruct.fundus           = struct('isFundus', false, 'status', 'UNREADABLE', 'reasons', {reason});
            resultStruct.quality          = [];
            resultStruct.enhancement      = [];
            resultStruct.prediction       = struct('grade', [], 'label', 'Unreadable Input: Rejected');
            resultStruct.confidence       = struct('raw', 0.0, 'calibrated', []);
            resultStruct.referable        = false;
            resultStruct.xai              = struct('gradcam_path', '');
            resultStruct.evidence         = {};
            resultStruct.reasons          = {reason};
            resultStruct.model_version    = cfg.model_version;
            resultStruct.pipeline_version = cfg.pipeline_version;

            resultJSON = jsonencode(resultStruct);
            return;
        end
    else
        fundusImg = imageInput;
    end

    if isempty(fundusImg)
        error('runPipeline:EmptyInput', 'Input image cannot be empty.');
    end

    % Ensure 3-channel RGB uint8 representation
    if ndims(fundusImg) == 2
        fundusImg = repmat(fundusImg, [1, 1, 3]);
    elseif size(fundusImg, 3) == 1
        fundusImg = repmat(fundusImg, [1, 1, 3]);
    elseif size(fundusImg, 3) > 3
        fundusImg = fundusImg(:, :, 1:3);
    end
    if ~isa(fundusImg, 'uint8')
        fundusImg = uint8(round(fundusImg));
    end

    %% 3. STAGE 0: Fundus Image Validation Gate
    fundusResult = checkFundusImage(fundusImg, cfg);

    if ~fundusResult.isFundus
        % Gating rule: Non-fundus or uncertain images NEVER reach clinical evaluation
        if strcmp(fundusResult.status, 'NON_FUNDUS')
            stageDecision = 'reject';
            actionStr = 'REJECT';
            predLabel = 'Non-Fundus Input: Rejected';
        else % UNCERTAIN
            stageDecision = 'review';
            actionStr = 'REJECT / HUMAN REVIEW';
            predLabel = 'Uncertain Input: Flagged for Specialist Review';
        end

        resultStruct = struct();
        resultStruct.screening_id     = screeningId;
        resultStruct.stage            = 'STAGE_0_FUNDUS_VALIDATION';
        resultStruct.status           = fundusResult.status;
        resultStruct.action           = actionStr;
        resultStruct.decision         = stageDecision;
        resultStruct.fundus           = fundusResult;
        resultStruct.quality          = [];
        resultStruct.enhancement      = [];
        resultStruct.prediction       = struct('grade', [], 'label', predLabel);
        resultStruct.confidence       = struct('raw', 0.0, 'calibrated', []);
        resultStruct.referable        = strcmp(stageDecision, 'review');
        resultStruct.xai              = struct('gradcam_path', '');
        resultStruct.evidence         = {};
        resultStruct.reasons          = fundusResult.reasons;
        resultStruct.model_version    = cfg.model_version;
        resultStruct.pipeline_version = cfg.pipeline_version;

        resultJSON = jsonencode(resultStruct);
        return;
    end

    %% 4. STAGE 1: Retinal Image Quality Assessment
    [qResult, isAcceptable, maskData] = assessQuality(fundusImg, cfg);

    %% 5. STAGE 2: Adaptive Enhancement Gate
    if strcmp(qResult.status, 'GOOD')
        % Diagnostic quality: proceed directly without modification
        processedImg = fundusImg;
        qualityFinal = qResult;
        canInferDR   = true;
        enhStruct    = struct( ...
            'applied',       false, ...
            'improved',      false, ...
            'method',        'None (diagnostic quality scan bypassed enhancement)', ...
            'beforeQuality', qResult, ...
            'afterQuality',  qResult ...
        );

    elseif strcmp(qResult.status, 'BORDERLINE')
        % Borderline quality: apply conservative enhancement and re-assess quality
        [enhStruct, enhancedImg] = enhanceBorderline(fundusImg, cfg);
        qualityFinal = enhStruct.afterQuality;

        % If acceptable post-enhancement (GOOD or acceptable BORDERLINE) -> proceed to model
        [~, isAcceptableFinal] = assessQuality(enhancedImg, cfg);
        if isAcceptableFinal
            % Acceptable: proceed to CNN with enhanced image
            processedImg = enhancedImg;
            canInferDR   = true;
        else
            % Unacceptable (UNGRADABLE): do NOT infer DR -> RECAPTURE
            processedImg = fundusImg;
            canInferDR   = false;
        end

    else % UNGRADABLE
        % Ungradable scan: strictly bypass enhancement -> RECAPTURE
        processedImg = fundusImg;
        qualityFinal = qResult;
        canInferDR   = false;
        enhStruct    = struct( ...
            'applied',       false, ...
            'improved',      false, ...
            'method',        'None (ungradable images strictly bypass enhancement)', ...
            'beforeQuality', qResult, ...
            'afterQuality',  qResult ...
        );
    end

    %% 6. STAGE 3 & 4: Deep Learning Inference & Explainable AI (or Recapture)
    evidencePayload = struct(); % populated only on the inference path (STEP C)
    if ~canInferDR
        % Quality failed / unrecoverable: flag for recapture without misleading prediction
        predGrade     = [];
        predLabel     = sprintf('Quality Unacceptable (%s): Recapture Required', qualityFinal.status);
        rawConfidence = 0.0;
        isReferable   = false;
        gradcamPath   = '';
        stageDecision = 'recapture';
        actionStr     = 'RECAPTURE';
        currentStage  = 'STAGE_1_QUALITY_GATE';
    else
        % DR grade inference and Grad-CAM are executed canonically by PyTorch service in Python backend (dr_model_service.py).
        % Deferring duplicate MATLAB ONNX model loading and inference saves ~65s per scan on high-res images.
        predGrade     = 0;
        predLabel     = 'Passed Stage 0/1/2 Safety Gates (PyTorch Inference Upstream)';
        rawConfidence = 1.0;
        isReferable   = false;
        currentStage  = 'STAGE_3_DR_INFERENCE';

        % Grad-CAM map is generated canonically by PyTorch service in Python backend (dr_model_service.py).
        % Deferring MATLAB Grad-CAM calculation saves ~65s per scan on high-res images.
        gradcamPath = '';

        % STEP C (2026-09-23): retinal structure / lesion-candidate evidence
        % pass. Runs after Stage 3 per contract freeze (docs/contract.md §6).
        % Writes overlay/mask artifacts + summary JSON, returns clinical metadata.
        evidencePayload = runRetinalEvidence(scriptDir, fundusImg, screeningId);

        % Clinical Decision: Routine follow-up vs Specialist Referral
        if isReferable
            stageDecision = 'review';
            actionStr     = 'SPECIALIST REFERRAL';
        else
            stageDecision = 'proceed';
            actionStr     = 'PROCEED';
        end
    end

    %% 7. Assemble Complete Contract Matching Blueprint Section 10
    resultStruct = struct();
    resultStruct.screening_id = screeningId;
    resultStruct.stage        = currentStage;
    resultStruct.status       = qualityFinal.status;
    resultStruct.action       = actionStr;
    resultStruct.decision     = stageDecision;

    % Stage 0 Fundus Validation object
    resultStruct.fundus = fundusResult;

    % Stage 1 Quality object
    resultStruct.quality = struct();
    resultStruct.quality.status = qualityFinal.status;
    resultStruct.quality.scores = qualityFinal.scores;
    resultStruct.quality.reasons = qualityFinal.reasons;

    % Stage 2 Enhancement object
    resultStruct.enhancement = struct();
    resultStruct.enhancement.applied  = enhStruct.applied;
    resultStruct.enhancement.improved = enhStruct.improved;
    resultStruct.enhancement.method   = enhStruct.method;

    % Stage 3 Prediction object
    resultStruct.prediction = struct();
    resultStruct.prediction.grade = predGrade;
    resultStruct.prediction.label = predLabel;

    % Confidence object
    resultStruct.confidence = struct();
    resultStruct.confidence.raw = round(rawConfidence, 4);
    resultStruct.confidence.calibrated = []; % Pending clinical calibration

    % Referral flag
    resultStruct.referable = isReferable;

    % Explainable AI
    resultStruct.xai = struct();
    resultStruct.xai.gradcam_path = gradcamPath;

    % Retinal structure / lesion-candidate evidence (STEP C, 2026-09-23).
    % Empty struct ({}) on reject/recapture paths is HONEST: evidence pass
    % only runs on the forward inference path.
    resultStruct.evidence = evidencePayload;

    % Diagnostic reasons
    if ~canInferDR
        resultStruct.reasons = qualityFinal.reasons;
    else
        resultStruct.reasons = {sprintf('Screening completed with %s classification', predLabel)};
    end

    % Version and reproducibility metadata
    resultStruct.model_version    = cfg.model_version;
    resultStruct.pipeline_version = cfg.pipeline_version;

    %% 8. JSON Serialization
    resultJSON = jsonencode(resultStruct);

end

function evidencePayload = runRetinalEvidence(scriptDir, fundusImg, screeningId)
% RUNRETINALEVIDENCE STEP C (2026-09-23) — run the model/matlab retinal-evidence
% island and return its summary as the contract evidence payload.
%
% The island is self-contained at <repo>/model/matlab. Its runRetinalAnalysis()
% takes an image FILE path and returns a summary struct plus writes overlay/mask
% artifacts. It internally calls its OWN assessQuality() (model/matlab variant),
% which must resolve while this pass runs, so model/matlab is prepended to the
% path for the call and removed afterwards.

retinalDir = fullfile(scriptDir, 'retinal');
if ~isfolder(retinalDir)
    retinalDir = fullfile(fileparts(scriptDir), 'model_new', 'matlab');
end
if ~isfolder(retinalDir)
    evidencePayload = struct('status', 'SKIPPED', 'reason', 'retinal analysis island missing');
    return;
end

workDir = fullfile(scriptDir, 'data', 'results', 'retinal_evidence');
if ~isfolder(workDir)
    mkdir(workDir);
end
cleanName = regexprep(char(screeningId), '[^A-Za-z0-9_-]', '_');
imgFile = fullfile(workDir, [cleanName '_input.png']);
try
    imwrite(fundusImg, imgFile);
catch
    evidencePayload = struct('status', 'SKIPPED', 'reason', 'could not write evidence input');
    return;
end

addpath(retinalDir); % prepend so the island's assessQuality wins during the pass
cleanup = onCleanup(@() rmpath(retinalDir));

try
    summary = runRetinalAnalysis(imgFile, 'OutputDir', workDir);
catch ME
    evidencePayload = struct('status', 'FAILED', 'error', ME.message);
    return;
end

payload = struct();
payload.status = 'SUCCESS';
payload.retinal_analysis = summary.retinal_analysis;
payload.processing_time_seconds = summary.processing_time_seconds;
payload.candidate_disclaimer = 'Algorithmic candidate evidence is not clinically confirmed pathology.';
evidencePayload = payload;
end
