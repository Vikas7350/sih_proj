function parityResults = testParity()
% TESTPARITY Numerical parity verification between Python PyTorch and MATLAB
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Loads Python v2 reference predictions from 'data/results/python_parity_reference_v2.json'
%   (REAL model logits generated on local images, Phase 2, Rule 9/10) and compares
%   them against MATLAB inference probabilities on the exact same images.
%
% Parity Criterion:
%   Maximum absolute probability difference < 1e-4 across all 5 DR classes.

    fprintf('=================================================================\n');
    fprintf(' NetraCare SIH 26038: Python <-> MATLAB Model Parity Verification\n');
    fprintf(' (Phase 2 - real model v2 reference)\n');
    fprintf('=================================================================\n\n');

    % Setup paths
    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    addpath(fullfile(projectRoot, 'config'));
    addpath(fullfile(projectRoot, 'model'));
    addpath(projectRoot);

    cfg = model_config();

    % 1. Load Python v2 reference results
    refPath = fullfile(projectRoot, 'data', 'results', 'python_parity_reference_v2.json');

    refData = jsondecode(fileread(refPath));
    numImages = numel(refData);
    fprintf('Loaded %d Python reference cases from: %s\n\n', numImages, refPath);

    % 2. Load Real Imported Model
    fprintf('Loading model... ');
    net = loadModel(cfg.model.onnx_file, cfg);

    if isstruct(net) && isfield(net, 'is_placeholder') && net.is_placeholder
        warning('testParity:ModelPlaceholder', ...
            'Model is currently in placeholder mode (ONNX import not yet executed in MATLAB).');
    else
        fprintf('Loaded real deep learning network successfully.\n');
    end

    % 3. Run Inference and Compare
    maxGlobalDiff = 0.0;
    passedAll = true;
    comparisonList = cell(numImages, 1);

    fprintf('%-14s | %-12s | %-12s | %-10s | %-12s\n', ...
        'Image', 'Py Grade', 'MATLAB Grade', 'Max Diff', 'Parity Status');
    fprintf('%s\n', repmat('-', [1, 70]));

    for i = 1:numImages
        entry = refData(i);
        imgPath = entry.image_path;

        % Run MATLAB inference
        [matlabGrade, matlabProbs, ~] = predictDR(net, imgPath, cfg);

        pyProbs = reshape(entry.probabilities, [1, 5]);
        diffs = abs(matlabProbs - pyProbs);
        maxImgDiff = max(diffs);

        if maxImgDiff > maxGlobalDiff
            maxGlobalDiff = maxImgDiff;
        end

        isMatch = (maxImgDiff < 1e-4);
        if ~isMatch
            passedAll = false;
            statusStr = 'FAIL';
        else
            statusStr = 'PASS';
        end

        fprintf('%-14s | Grade %-6d | Grade %-6d | %-10.6f | %-12s\n', ...
            entry.image_filename, entry.predicted_grade, matlabGrade, maxImgDiff, statusStr);

        record = struct();
        record.image = entry.image_filename;
        record.py_grade = entry.predicted_grade;
        record.matlab_grade = matlabGrade;
        record.py_probs = pyProbs;
        record.matlab_probs = matlabProbs;
        record.max_diff = maxImgDiff;
        record.passed = isMatch;
        comparisonList{i} = record;
    end

    fprintf('%s\n\n', repmat('-', [1, 70]));
    fprintf('Maximum Absolute Probability Difference : %.6e\n', maxGlobalDiff);
    fprintf('Parity Tolerance Threshold              : 1.000000e-04\n');

    if passedAll
        fprintf('OVERALL STATUS: PARITY PASSED (All differences < 1e-4)\n\n');
    else
        fprintf('OVERALL STATUS: PARITY PENDING / FAILED\n\n');
    end

    parityResults = struct();
    parityResults.max_diff = maxGlobalDiff;
    parityResults.passed = passedAll;
    parityResults.comparisons = comparisonList;

    % 4. Write MATLAB-side parity results (Rule 9/10 artifact)
    outPath = fullfile(projectRoot, 'data', 'results', 'matlab_python_parity_v2.json');
    outStruct = struct();
    outStruct.generated_by = 'Matlab/testParity.m (Phase 2)';
    outStruct.reference = refPath;
    outStruct.tolerance = 1e-4;
    outStruct.max_diff = maxGlobalDiff;
    outStruct.passed = passedAll;
    outStruct.comparisons = comparisonList;
    fid = fopen(outPath, 'w');
    fprintf(fid, '%s', jsonencode(outStruct));
    fclose(fid);
    fprintf('MATLAB parity results written: %s\n', outPath);

end
