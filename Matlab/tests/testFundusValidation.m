function results = testFundusValidation()
% TESTFUNDUSVALIDATION Test Stage 0 Fundus Validation across 7 benchmark images
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Evaluates Stage 0 screening gate across Phase 1/2 verified images:
%   - SCR-0062.jpg -> FUNDUS (passes)
%   - SCR-0044.jpg -> FUNDUS (passes)
%   - SCR-0001, 0002, 0003, 0004, 0055, 0066 -> NON_FUNDUS (rejected)
%   - SCR-0050.jpg -> UNCERTAIN
%   Verifies file-path and in-memory matrix equivalence.
%   Generates diagnostic visualization artifacts.

    fprintf('=================================================================================================================\n');
    fprintf(' NetraCare SIH 26038: Stage 0 Fundus Image Validation Test Harness\n');
    fprintf(' (Phase 2: verified local fixtures)\n');
    fprintf('=================================================================================================================\n\n');

    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    addpath(fullfile(projectRoot, 'config'));
    addpath(fullfile(projectRoot, 'quality'));
    addpath(fullfile(projectRoot, 'model'));

    cfg = model_config();
    uploads = fullfile(projectRoot, '..', 'backend', 'storage', 'uploads');

    % Phase 1 probe results (documented in model_selection_audit.md)
    cases = { ...
        'SCR-0062.jpg', 'FUNDUS'; ...
        'SCR-0044.jpg', 'FUNDUS'; ...
        'SCR-0001.jpg', 'NON_FUNDUS'; ...
        'SCR-0002.jpg', 'NON_FUNDUS'; ...
        'SCR-0003.jpg', 'NON_FUNDUS'; ...
        'SCR-0004.jpg', 'NON_FUNDUS'; ...
        'SCR-0055.jpg', 'NON_FUNDUS'; ...
        'SCR-0066.jpg', 'NON_FUNDUS'; ...
        'SCR-0050.jpg', 'UNCERTAIN'; ...
    };
    numImages = size(cases, 1);

    fprintf('%-13s | %-11s | %-11s | %-11s | %-10s | %-7s | %s\n', ...
        'Image', 'Expected', 'Predicted', 'Fundus Score', 'Confidence', 'Passed?', 'Primary Reason');
    fprintf('%s\n', repmat('-', [1, 115]));

    results = cell(numImages, 1);
    numPassed = 0;

    for i = 1:numImages
        imgPath = fullfile(uploads, cases{i, 1});
        if ~isfile(imgPath)
            fprintf('%-13s | SKIP (missing %s)\n', cases{i, 1}, imgPath);
            continue;
        end
        [~, fname, ext] = fileparts(imgPath);
        imgName = [fname, ext];
        expected = cases{i, 2};

        % 1. Evaluate file path input
        fundus = checkFundusImage(imgPath, cfg);

        % 2. Evaluate in-memory uint8 array equivalence
        imgMatrix = imread(imgPath);
        fundusMem = checkFundusImage(imgMatrix, cfg);

        assert(fundus.isFundus == fundusMem.isFundus, ...
            'Validation decision mismatch between file-path and in-memory inputs for %s', imgName);
        assert(abs(fundus.score - fundusMem.score) < 1e-5, ...
            'Validation score mismatch between file-path and in-memory inputs for %s', imgName);

        % 3. Check against expected label
        if strcmp(expected, 'FUNDUS')
            isCorrect = strcmp(fundus.status, 'FUNDUS') && fundus.isFundus;
        elseif strcmp(expected, 'UNCERTAIN')
            isCorrect = strcmp(fundus.status, 'UNCERTAIN');
        else
            isCorrect = ~strcmp(fundus.status, 'FUNDUS') && ~fundus.isFundus;
        end

        if isCorrect
            passStr = 'PASS';
            numPassed = numPassed + 1;
        else
            passStr = 'FAIL';
        end

        primaryReason = fundus.reasons{1};
        if length(primaryReason) > 42
            primaryReason = [primaryReason(1:39), '...'];
        end

        fprintf('%-13s | %-11s | %-11s | %-11.4f | %-10.4f | %-7s | %s\n', ...
            imgName, expected, fundus.status, fundus.score, fundus.confidence, passStr, primaryReason);

        results{i} = fundus;
    end

    fprintf('%s\n', repmat('-', [1, 115]));
    fprintf(' Summary: %d of %d benchmark images correctly screened (%.1f%% Accuracy)\n\n', ...
        numPassed, numImages, (numPassed / numImages) * 100);

    %% Generate Visualizations for Key Demonstrations
    resultsDir = fullfile(projectRoot, 'data', 'results');
    if ~exist(resultsDir, 'dir')
        mkdir(resultsDir);
    end

    % 1. SCR-0062 (Verified FUNDUS)
    scr3Path = fullfile(uploads, 'SCR-0062.jpg');
    out3Path = fullfile(resultsDir, 'fundus_check_SCR-0062.png');
    fig3 = visualizeFundusCheck(scr3Path, out3Path, cfg);
    close(fig3);

    % 2. SCR-0001 (Verified NON_FUNDUS)
    scr5Path = fullfile(uploads, 'SCR-0001.jpg');
    out5Path = fullfile(resultsDir, 'fundus_check_SCR-0001.png');
    fig5 = visualizeFundusCheck(scr5Path, out5Path, cfg);
    close(fig5);

    fprintf('Diagnostic visual demonstrations saved to:\n');
    fprintf('  - %s\n', out3Path);
    fprintf('  - %s\n\n', out5Path);

end
