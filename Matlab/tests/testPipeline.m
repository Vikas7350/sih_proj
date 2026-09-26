function results = testPipeline()
% TESTPIPELINE Comprehensive test suite for NetraCare Clinical AI Workstream
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Validates all clinical AI stages (Stage 0 Fundus Validation, Stage 1 Quality
%   Assessment, Stage 2 Borderline Enhancement, Stage 3 DR Inference, Stage 4
%   Grad-CAM Explainability) and verifies full compliance with the Blueprint
%   Section 10 FastAPI <-> MATLAB JSON Contract.
%
% Syntax:
%   results = testPipeline()

    fprintf('=================================================================\n');
    fprintf(' NetraCare SIH 26038: Clinical AI Workstream Test Suite           \n');
    fprintf('=================================================================\n\n');

    % Setup paths
    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    addpath(fullfile(projectRoot, 'config'));
    addpath(fullfile(projectRoot, 'quality'));
    addpath(fullfile(projectRoot, 'enhancement'));
    addpath(fullfile(projectRoot, 'model'));
    addpath(fullfile(projectRoot, 'xai'));
    addpath(fullfile(projectRoot, 'evaluation'));
    addpath(projectRoot);

    cfg = model_config();
    % Phase 6 fixtures: fundus-valid SCR-0062, non-fundus SCR-0003 (verified
    % Stage-0 NON_FUNDUS by docs/evidence/phase5/validation_results.json VAL-005),
    % uncertain SCR-0050.
    rawDir = fullfile(projectRoot, 'data', 'raw');
    scrFundus = fullfile(rawDir, 'SCR-0062.jpg');
    scrNonFundus = fullfile(rawDir, 'SCR-0003.jpg');
    scr3Path = scrFundus;
    scr5Path = scrNonFundus;

    testCount = 0;
    passCount = 0;

    %% Test 1: Configuration Loading
    testCount = testCount + 1;
    fprintf('[Test %d] Loading model_config & fundus_config... ', testCount);
    try
        assert(isfield(cfg, 'classes'), 'cfg must contain classes');
        assert(numel(cfg.classes.grades) == 5, 'Must have 5 ICDR classes');
        assert(isfield(cfg, 'fundus'), 'cfg must have fundus config');
        assert(isfield(cfg, 'quality'), 'cfg must have quality config');
        assert(isfield(cfg, 'enhancement'), 'cfg must have enhancement config');
        assert(isfield(cfg, 'model_version'), 'cfg must have model_version');
        assert(isfield(cfg, 'pipeline_version'), 'cfg must have pipeline_version');
        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 2: Stage 0 Fundus Image Validation Gate
    testCount = testCount + 1;
    fprintf('[Test %d] Testing Stage 0 checkFundusImage (Fundus vs Non-Fundus)... ', testCount);
    try
        if ~isempty(scr3Path) && isfile(scr3Path)
            % Genuine fundus must pass
            fFundus = checkFundusImage(scr3Path, cfg);
            assert(fFundus.isFundus == true, 'SCR-0003 must pass fundus screening');
            assert(strcmp(fFundus.status, 'FUNDUS'), 'SCR-0003 status must be FUNDUS');
        end

        if ~isempty(scr5Path) && isfile(scr5Path)
            % Non-biological surface must be rejected
            fWatermelon = checkFundusImage(scr5Path, cfg);
            assert(fWatermelon.isFundus == false, 'SCR-0003 must be rejected');
            assert(strcmp(fWatermelon.status, 'NON_FUNDUS'), 'SCR-0003 status must be NON_FUNDUS');
        end
        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 3: Quality Assessment (Gradable & Ungradable)
    testCount = testCount + 1;
    fprintf('[Test %d] Testing assessQuality... ', testCount);
    try
        sampleImg = uint8(120 * ones(224, 224, 3));
        [qResult, isAcc] = assessQuality(sampleImg, cfg);
        assert(isstruct(qResult), 'quality result must be struct');
        assert(isfield(qResult, 'status'), 'quality result must have status');
        assert(isfield(qResult, 'scores'), 'quality result must have scores');
        assert(isfield(qResult.scores, 'overall'), 'scores must have overall');
        assert(islogical(isAcc), 'isAcceptable must be logical');

        % Black / empty image rejection test
        blackImg = uint8(zeros(224, 224, 3));
        [qBlack, isAccBlack] = assessQuality(blackImg, cfg);
        assert(strcmpi(qBlack.status, 'UNGRADABLE'), 'Black image must be ungradable');
        assert(isAccBlack == false, 'Ungradable image must not be acceptable');

        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 4: Borderline Enhancement
    testCount = testCount + 1;
    fprintf('[Test %d] Testing enhanceBorderline... ', testCount);
    try
        sampleImg = uint8(100 * ones(224, 224, 3));
        [enhancement, enhanced] = enhanceBorderline(sampleImg, cfg);
        assert(isstruct(enhancement), 'enhancement must be struct');
        assert(isfield(enhancement, 'applied'), 'enhancement must have applied');
        assert(isequal(size(enhanced), size(sampleImg)), 'Enhanced size must match input size');
        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 5: Model Loading (Trained EfficientNet-B0)
    testCount = testCount + 1;
    fprintf('[Test %d] Testing loadModel... ', testCount);
    try
        net = loadModel('', cfg);
        assert(~isempty(net), 'Model must not be empty');
        assert(isa(net, 'dlnetwork'), 'Phase 2: expected real dlnetwork, got %s', class(net));
        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 6: DR Severity Prediction
    testCount = testCount + 1;
    fprintf('[Test %d] Testing predictDR... ', testCount);
    try
        sampleImg = uint8(120 * ones(224, 224, 3));
        [grade, probs, predStruct] = predictDR(net, sampleImg, cfg);
        assert(grade >= 0 && grade <= 4, 'Grade must be between 0 and 4');
        assert(numel(probs) == 5, 'Probabilities vector must have length 5');
        assert(isstruct(predStruct), 'predStruct must be a struct');
        assert(isfield(predStruct, 'referable'), 'predStruct must contain referable flag');
        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 7: Explainable AI (Grad-CAM)
    testCount = testCount + 1;
    fprintf('[Test %d] Testing generateGradCAM... ', testCount);
    try
        sampleImg = uint8(120 * ones(224, 224, 3));
        [heatmap, overlayPath] = generateGradCAM(net, sampleImg, 1, cfg);
        assert(isequal(size(heatmap), [224, 224]), 'Heatmap dimensions mismatch');
        assert(isfile(overlayPath), 'Grad-CAM overlay PNG must exist on disk');
        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 8: Clinical Evaluation Metrics
    testCount = testCount + 1;
    fprintf('[Test %d] Testing evaluateDR... ', testCount);
    try
        groundTruth = [0; 1; 2; 3; 4; 0; 2];
        predictions = [0; 1; 2; 2; 4; 0; 3];
        metrics = evaluateDR(groundTruth, predictions, cfg);
        assert(isstruct(metrics), 'Metrics must be struct');
        assert(~isnan(metrics.accuracy), 'Accuracy must be valid number');
        assert(metrics.sample_count == 7, 'Sample count mismatch');
        assert(isequal(size(metrics.confusion_matrix), [5, 5]), 'Confusion matrix must be 5x5');
        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test 9: End-to-End runPipeline & Safety Gate Verification
    testCount = testCount + 1;
    fprintf('[Test %d] Testing runPipeline End-to-End & Blueprint Contract... ', testCount);
    try
        % 1. Test Default / Genuine Fundus execution
        [resultJSON, resultStruct] = runPipeline([], 'TEST-SCREENING-001');
        assert(ischar(resultJSON), 'runPipeline must return JSON char string');
        assert(isstruct(resultStruct), 'runPipeline must return result struct');

        decoded = jsondecode(resultJSON);
        requiredFields = { ...
            'screening_id', ...
            'stage', ...
            'action', ...
            'decision', ...
            'fundus', ...
            'quality', ...
            'prediction', ...
            'confidence', ...
            'referable', ...
            'xai', ...
            'evidence', ...
            'reasons', ...
            'model_version', ...
            'pipeline_version' ...
        };
        for i = 1:numel(requiredFields)
            f = requiredFields{i};
            assert(isfield(decoded, f), sprintf('Missing contract field: %s', f));
        end

        validDecisions = {'proceed', 'review', 'recapture', 'reject'};
        assert(ismember(decoded.decision, validDecisions), 'Invalid decision value');

        % 2. Test Non-Fundus (SCR-0003) Immediate Rejection at Stage 0
        if ~isempty(scr5Path) && isfile(scr5Path)
            [rejJSON, rejStruct] = runPipeline(scr5Path, 'TEST-NONFUNDUS-001');
            assert(strcmp(rejStruct.stage, 'STAGE_0_FUNDUS_VALIDATION'), 'Non-fundus must stop at Stage 0');
            assert(strcmp(rejStruct.action, 'REJECT'), 'Action must be REJECT');
            assert(strcmp(rejStruct.decision, 'reject'), 'Decision must be reject');
            assert(isempty(rejStruct.quality), 'Quality must be empty for non-fundus');
            assert(isempty(rejStruct.prediction.grade), 'Grade must be empty for non-fundus');
        end

        fprintf('PASSED\n');
        passCount = passCount + 1;
    catch ME
        fprintf('FAILED: %s\n', ME.message);
    end

    %% Test Summary
    fprintf('\n-----------------------------------------------------------------\n');
    fprintf(' Test Summary: %d of %d tests passed successfully.\n', passCount, testCount);
    fprintf('-----------------------------------------------------------------\n\n');

    results = struct();
    results.total = testCount;
    results.passed = passCount;
    results.all_passed = (passCount == testCount);

end
