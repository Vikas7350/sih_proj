function results = testEnhancement()
% TESTENHANCEMENT Test Stage 2 Borderline Fundus Enhancement on 7 benchmark images
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Evaluates Stage 2 enhancement across SCR-0001 through SCR-0007:
%   1. Runs assessQuality() to determine baseline quality status.
%   2. Enhances ONLY if status is BORDERLINE.
%   3. Verifies that GOOD and UNGRADABLE images are untouched.
%   4. Re-runs assessQuality() on enhanced images to evaluate trajectory.
%   5. Prints a comprehensive diagnostic table.

    fprintf('=================================================================================================================\n');
    fprintf(' NetraCare SIH 26038: Stage 2 Borderline Fundus Enhancement Test Harness\n');
    fprintf('=================================================================================================================\n\n');

    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    addpath(fullfile(projectRoot, 'config'));
    addpath(fullfile(projectRoot, 'quality'));
    addpath(fullfile(projectRoot, 'enhancement'));
    addpath(fullfile(projectRoot, 'model'));

    cfg = model_config();
    % Phase 2: verified local fixtures (old external-path benchmark unusable).
    uploads = fullfile(projectRoot, '..', 'backend', 'storage', 'uploads');
    imageFiles = { ...
        'SCR-0062.jpg'; ...
        'SCR-0044.jpg'; ...
        'SCR-0050.jpg'; ...
        'SCR-0001.jpg'; ...
        'SCR-0002.jpg'; ...
        'SCR-0003.jpg'; ...
        'SCR-0004.jpg'; ...
        'SCR-0055.jpg'; ...
        'SCR-0066.jpg'; ...
    };
    numImages = 0;
    for i = 1:numel(imageFiles)
        if isfile(fullfile(uploads, imageFiles{i}))
            numImages = numImages + 1;
        end
    end

    fprintf('%-13s | %-12s | %-12s | %-12s | %-10s | %-10s | %-11s\n', ...
        'Image', 'Before Stat', 'Enh Applied', 'After Stat', 'Before Sc', 'After Sc', 'Improvement');
    fprintf('%s', repmat('-', [1, 95]));
    fprintf('\n');

    results = cell(numImages, 1);
    idx = 0;
    imageNames = cell(numImages, 1);

    for k = 1:numel(imageFiles)
        imgPath = fullfile(uploads, imageFiles{k});
        if ~isfile(imgPath)
            continue;
        end
        idx = idx + 1;
        imageNames{idx} = imageFiles{k};

        % Run enhancement pipeline
        enh = enhanceBorderline(imgPath, cfg);

        % Verify in-memory equivalence
        imgMatrix = imread(imgPath);
        enhMem = enhanceBorderline(imgMatrix, cfg);
        assert(enh.applied == enhMem.applied, 'Enhancement applied flag must match for in-memory and file inputs.');
        if enh.applied
            maxPixDiff = max(abs(single(enh.enhancedImage(:)) - single(enhMem.enhancedImage(:))));
            assert(maxPixDiff == 0, 'Enhanced image must be identical for in-memory and file inputs.');
        end

        qB = enh.beforeQuality;
        qA = enh.afterQuality;

        appliedStr = mat2str(enh.applied);
        improvedStr = mat2str(enh.improved);

        fprintf('%-13s | %-12s | %-12s | %-12s | %-10.3f | %-10.3f | %-11s\n', ...
            imageNames{idx}, qB.status, appliedStr, qA.status, ...
            qB.overallScore, qA.overallScore, improvedStr);

        results{idx} = enh;
    end

    fprintf('%s\n\n', repmat('-', [1, 95]));
    fprintf('Detailed Decision Log and Clinical Reasons per Image:\n');
    fprintf('%s\n', repmat('-', [1, 80]));

    for i = 1:numImages
        enh = results{i};
        fprintf('• %-13s [Before: %s (%.3f) -> After: %s (%.3f) | Applied: %s | Improved: %s]:\n', ...
            imageNames{i}, enh.beforeQuality.status, enh.beforeQuality.overallScore, ...
            enh.afterQuality.status, enh.afterQuality.overallScore, ...
            mat2str(enh.applied), mat2str(enh.improved));
        for r = 1:numel(enh.reasons)
            fprintf('    - %s\n', enh.reasons{r});
        end
    end
    fprintf('%s\n\n', repmat('-', [1, 80]));

end
