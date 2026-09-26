function results = testQuality()
% TESTQUALITY Test and benchmark Stage 1 Image Quality Assessment module
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Runs assessQuality() across the 7 benchmark fundus images (SCR-0001 to SCR-0007)
%   and displays a structured diagnostic report detailing Focus, Illumination,
%   Contrast, Field of View, Overall Score, Categorical Status, and Clinical Reasons.

    fprintf('========================================================================================================\n');
    fprintf(' NetraCare SIH 26038: Retinal Fundus Image Quality Assessment (Stage 1)\n');
    fprintf('========================================================================================================\n\n');

    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    addpath(fullfile(projectRoot, 'config'));
    addpath(fullfile(projectRoot, 'quality'));
    addpath(fullfile(projectRoot, 'model'));

    cfg = model_config();
    % Phase 2: use verified local fixtures (old benchmark reference pointed at
    % a non-existent external machine path and was unusable).
    uploads = fullfile(projectRoot, '..', 'backend', 'storage', 'uploads');
    images = { ...
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
    for i = 1:numel(images)
        if isfile(fullfile(uploads, images{i}))
            numImages = numImages + 1;
        end
    end

    fprintf('%-13s | %-15s | %-15s | %-15s | %-13s | %-8s | %-11s\n', ...
        'Image', 'Focus (LapVar)', 'Illum (MeanB)', 'Contrast (P95-5)', 'FOV Area', 'Score', 'Status');
    fprintf('%s\n', repmat('-', [1, 104]));

    results = cell(numImages, 1);
    idx = 0;

    for i = 1:numel(images)
        imgPath = fullfile(uploads, images{i});
        if ~isfile(imgPath)
            continue;
        end
        idx = idx + 1;

        % 1. Evaluate file path input
        q = assessQuality(imgPath, cfg);

        % 2. Verify in-memory input produces identical results
        imgMatrix = imread(imgPath);
        qMem = assessQuality(imgMatrix, cfg);
        assert(abs(q.overallScore - qMem.overallScore) < 1e-6, ...
            'Quality evaluation must be identical for file and in-memory inputs.');

        focusStr = sprintf('%.2f (%s)', q.focus.rawMetric, q.focus.status);
        illumStr = sprintf('%.1f (%s)', q.illumination.rawMetric, q.illumination.status);
        contrStr = sprintf('%.1f (%s)', q.contrast.rawMetric, q.contrast.status);
        fovStr   = sprintf('%.1f%% (%s)', q.fov.rawMetric * 100, q.fov.status);

        fprintf('%-13s | %-15s | %-15s | %-15s | %-13s | %-8.3f | %-11s\n', ...
            images{i}, focusStr, illumStr, contrStr, fovStr, q.overallScore, q.status);

        res = struct();
        res.image = images{i};
        res.quality = q;
        results{idx} = res;
    end

    fprintf('%s\n\n', repmat('-', [1, 104]));
    fprintf('Diagnostic Findings & Clinical Reasons per Image:\n');
    fprintf('%s\n', repmat('-', [1, 70]));

    for i = 1:numImages
        res = results{i};
        q = res.quality;
        fprintf('• %-13s [%s | Overall Score: %.3f]:\n', res.image, q.status, q.overallScore);
        for r = 1:numel(q.reasons)
            fprintf('    - %s\n', q.reasons{r});
        end
    end
    fprintf('%s\n\n', repmat('-', [1, 70]));

end
