function [quality, isAcceptable, maskData] = assessQuality(inputImg, cfg)
% ASSESSQUALITY Assess retinal fundus image quality prior to clinical AI inference
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   quality = assessQuality(inputImg)
%   [quality, isAcceptable] = assessQuality(inputImg, cfg)
%   [quality, isAcceptable, maskData] = assessQuality(inputImg, cfg)
%
% Inputs:
%   inputImg - File path string OR RGB image matrix (uint8 / double)
%   cfg      - (Optional) Configuration struct from model_config() or quality_config()
%
% Outputs:
%   quality  - Struct conforming to project blueprint:
%              .status             - 'GOOD' | 'BORDERLINE' | 'UNGRADABLE'
%              .overallScore       - Composite quality score in [0.0, 1.0]
%              .focus.score        - Focus / sharpness normalized score [0, 1]
%              .focus.rawMetric    - Raw Laplacian variance inside eroded FOV
%              .focus.status       - 'SHARP' | 'BORDERLINE' | 'BLURRY'
%              .illumination.score - Illumination normalized score [0, 1]
%              .illumination.rawMetric - Mean brightness inside FOV
%              .illumination.status- 'GOOD' | 'TOO_DARK' | 'TOO_BRIGHT' | 'UNEVEN'
%              .contrast.score     - Contrast normalized score [0, 1]
%              .contrast.rawMetric - Inter-percentile range (P95 - P5) inside FOV
%              .contrast.status    - 'GOOD' | 'BORDERLINE' | 'LOW_CONTRAST'
%              .fov.score          - Field of view normalized score [0, 1]
%              .fov.rawMetric      - Retinal tissue area ratio (0.0 to 1.0)
%              .fov.status         - 'GOOD' | 'BORDERLINE' | 'INSUFFICIENT'
%              .reasons            - Cell array of strings detailing quality warnings
%              .scores             - Substruct containing scores for Blueprint compatibility
%   isAcceptable - Boolean flag: true if status is 'GOOD' or 'BORDERLINE', false if 'UNGRADABLE'
%   maskData - (Optional) Struct containing binary .fovMask, .erodedMask, and analysis metadata
%
% Architecture & Regulatory Note:
%   Uses 100% MATLAB Image Processing Toolbox algorithms without external runtime
%   dependencies. Thresholds are baseline engineering values defined in
%   config/quality_config.m and are not claimed as clinically validated.

    %% 1. Configuration Resolution
    if nargin < 2 || isempty(cfg)
        cfg = model_config();
        qcfg = cfg.quality;
    elseif isfield(cfg, 'quality')
        qcfg = cfg.quality;
    else
        qcfg = cfg;
    end

    %% 2. Image Ingestion (Original Resolution Preserved)
    if ischar(inputImg) || isstring(inputImg)
        if ~isfile(inputImg)
            error('assessQuality:FileNotFound', 'Image file not found: %s', inputImg);
        end
        img = imread(char(inputImg));
    else
        img = inputImg;
    end

    if isempty(img)
        error('assessQuality:EmptyInput', 'Input image cannot be empty.');
    end

    % Ensure 3-channel RGB representation
    if ndims(img) == 2
        rgbImg = repmat(img, [1, 1, 3]);
    elseif size(img, 3) == 1
        rgbImg = repmat(img, [1, 1, 3]);
    elseif size(img, 3) > 3
        rgbImg = img(:, :, 1:3);
    else
        rgbImg = img;
    end

    if ~isa(rgbImg, 'uint8')
        rgbImg = uint8(round(rgbImg));
    end

    grayImg = rgb2gray(rgbImg);
    dblGray = double(grayImg);
    [imgH, imgW, ~] = size(rgbImg);
    totalPixels = imgH * imgW;

    %% 3. Field of View (FOV) Segmentation
    % Fundus reflectance is strongest in Red and Green channels.
    % Background aperture border is dark across all channels.
    maxChannel = max(rgbImg, [], 3);
    smoothMax = imgaussfilt(double(maxChannel), 2.0);
    
    bgThresh = qcfg.fov.bg_intensity_threshold;
    rawFovMask = smoothMax > bgThresh;
    rawFovMask = imfill(rawFovMask, 'holes');
    
    if qcfg.fov.clean_disk_radius > 0
        rawFovMask = imclose(rawFovMask, strel('disk', qcfg.fov.clean_disk_radius));
    end

    % Retain largest connected component (the circular/elliptical retinal aperture)
    cc = bwconncomp(rawFovMask);
    if cc.NumObjects > 0
        numPixels = cellfun(@numel, cc.PixelIdxList);
        [~, maxIdx] = max(numPixels);
        fovMask = false(size(rawFovMask));
        fovMask(cc.PixelIdxList{maxIdx}) = true;
    else
        fovMask = rawFovMask;
    end

    % Fallback if mask is degenerately empty
    if ~any(fovMask(:))
        fovMask = true(size(grayImg));
    end

    % Erode FOV mask by a safety margin to avoid edge artifacts from aperture rim
    erodedMask = imerode(fovMask, strel('disk', qcfg.fov.boundary_erosion_disk));
    if ~any(erodedMask(:))
        erodedMask = fovMask;
    end

    fovPixels = dblGray(fovMask);
    erodedPixels = dblGray(erodedMask);

    % --- FOV Metrics ---
    rawFovArea = sum(fovMask(:)) / double(totalPixels);
    
    if rawFovArea >= qcfg.fov.min_area_ratio_good
        fovScore = 0.80 + 0.20 * min(1.0, (rawFovArea - qcfg.fov.min_area_ratio_good) / (1.0 - qcfg.fov.min_area_ratio_good));
        fovStatus = 'GOOD';
    elseif rawFovArea >= qcfg.fov.min_area_ratio_border
        fovScore = 0.40 + 0.40 * (rawFovArea - qcfg.fov.min_area_ratio_border) / (qcfg.fov.min_area_ratio_good - qcfg.fov.min_area_ratio_border);
        fovStatus = 'BORDERLINE';
    else
        fovScore = max(0.0, 0.40 * (rawFovArea / qcfg.fov.min_area_ratio_border));
        fovStatus = 'INSUFFICIENT';
    end

    %% 4. Focus / Blur Metric (Laplacian Sharpness on Eroded FOV)
    % Evaluating inside erodedMask ensures the sharp circular camera border does not inflate sharpness.
    lapKernel = fspecial('laplacian', qcfg.focus.laplacian_alpha);
    lapFiltered = imfilter(dblGray, lapKernel, 'replicate');
    rawLapVar = var(lapFiltered(erodedMask));

    if rawLapVar >= qcfg.focus.raw_thresh_good
        focusScore = 0.70 + 0.30 * min(1.0, (rawLapVar - qcfg.focus.raw_thresh_good) / qcfg.focus.norm_saturation_ref);
        focusStatus = 'SHARP';
    elseif rawLapVar >= qcfg.focus.raw_thresh_border
        focusScore = 0.40 + 0.30 * (rawLapVar - qcfg.focus.raw_thresh_border) / (qcfg.focus.raw_thresh_good - qcfg.focus.raw_thresh_border);
        focusStatus = 'BORDERLINE';
    else
        focusScore = max(0.0, 0.40 * (rawLapVar / qcfg.focus.raw_thresh_border));
        focusStatus = 'BLURRY';
    end

    %% 5. Illumination Metric (Exposure, Saturation, Shadows, Uniformity)
    rawMeanBrightness = mean(fovPixels);
    
    % Saturation and Shadow ratios
    satPixels = sum(fovPixels >= qcfg.illumination.sat_intensity_thresh);
    satRatio  = satPixels / numel(fovPixels);
    
    darkPixels = sum(fovPixels <= qcfg.illumination.dark_intensity_thresh);
    darkRatio  = darkPixels / numel(fovPixels);

    % Spatial Illumination Uniformity (Grid Analysis)
    gridSize = qcfg.illumination.grid_blocks;
    [rIdx, cIdx] = find(fovMask);
    minR = min(rIdx); maxR = max(rIdx);
    minC = min(cIdx); maxC = max(cIdx);
    blockH = max(1, floor((maxR - minR + 1) / gridSize(1)));
    blockW = max(1, floor((maxC - minC + 1) / gridSize(2)));
    
    blockMeans = [];
    for br = 1:gridSize(1)
        rStart = minR + (br - 1) * blockH;
        rEnd   = min(maxR, rStart + blockH - 1);
        for bc = 1:gridSize(2)
            cStart = minC + (bc - 1) * blockW;
            cEnd   = min(maxC, cStart + blockW - 1);
            subMask = fovMask(rStart:rEnd, cStart:cEnd);
            if sum(subMask(:)) >= 0.35 * (blockH * blockW)
                subDbl = dblGray(rStart:rEnd, cStart:cEnd);
                blockMeans(end + 1) = mean(subDbl(subMask)); %#ok<AGROW>
            end
        end
    end
    
    if numel(blockMeans) > 1 && mean(blockMeans) > 0
        unevenCV = std(blockMeans) / mean(blockMeans);
    else
        unevenCV = 0.0;
    end

    % Sub-scores for illumination
    optMean = qcfg.illumination.optimal_mean;
    expDist = abs(rawMeanBrightness - optMean);
    expScore = max(0.0, 1.0 - (expDist / 85.0));
    satScore = max(0.0, 1.0 - 4.0 * satRatio);
    darkScore = max(0.0, 1.0 - 3.0 * darkRatio);
    uniformScore = max(0.0, 1.0 - (unevenCV / 0.70));
    
    illumScore = 0.40 * expScore + 0.25 * satScore + 0.15 * darkScore + 0.20 * uniformScore;
    illumScore = min(1.0, max(0.0, illumScore));

    % Status classification
    if satRatio > qcfg.illumination.max_sat_ratio_border || rawMeanBrightness > qcfg.illumination.max_mean_border
        illumStatus = 'TOO_BRIGHT';
    elseif darkRatio > qcfg.illumination.max_dark_ratio_border || rawMeanBrightness < qcfg.illumination.min_mean_border
        illumStatus = 'TOO_DARK';
    elseif unevenCV > qcfg.illumination.max_uneven_cv_good
        illumStatus = 'UNEVEN';
    else
        illumStatus = 'GOOD';
    end

    %% 6. Contrast Metric (Percentile Dynamic Range)
    pLowVal  = prctile(fovPixels, qcfg.contrast.p_low);
    pHighVal = prctile(fovPixels, qcfg.contrast.p_high);
    rawP95_5 = pHighVal - pLowVal;
    rawStd   = std(fovPixels);

    if rawP95_5 >= qcfg.contrast.raw_p95_5_good
        contrastScore = 0.70 + 0.30 * min(1.0, (rawP95_5 - qcfg.contrast.raw_p95_5_good) / qcfg.contrast.norm_saturation_ref);
        contrastStatus = 'GOOD';
    elseif rawP95_5 >= qcfg.contrast.raw_p95_5_border
        contrastScore = 0.40 + 0.30 * (rawP95_5 - qcfg.contrast.raw_p95_5_border) / (qcfg.contrast.raw_p95_5_good - qcfg.contrast.raw_p95_5_border);
        contrastStatus = 'BORDERLINE';
    else
        contrastScore = max(0.0, 0.40 * (rawP95_5 / qcfg.contrast.raw_p95_5_border));
        contrastStatus = 'LOW_CONTRAST';
    end

    %% 7. Overall Composite Scoring & Reasons
    wFocus = qcfg.weights.focus;
    wIllum = qcfg.weights.illumination;
    wContr = qcfg.weights.contrast;
    wFov   = qcfg.weights.fov;

    overallScore = wFocus * focusScore + ...
                   wIllum * illumScore + ...
                   wContr * contrastScore + ...
                   wFov   * fovScore;
    overallScore = min(1.0, max(0.0, overallScore));

    % Assemble Reasons for Quality Status
    reasons = {};

    if rawLapVar < qcfg.hard_fail.min_focus_lapvar
        reasons{end + 1} = 'Severe optical blur / loss of focus';
    elseif strcmp(focusStatus, 'BLURRY')
        reasons{end + 1} = 'Moderate blur detected';
    end

    if strcmp(illumStatus, 'TOO_DARK')
        reasons{end + 1} = sprintf('Underexposed / severely dark illumination (mean=%.1f)', rawMeanBrightness);
    elseif strcmp(illumStatus, 'TOO_BRIGHT')
        reasons{end + 1} = sprintf('Overexposed / saturated highlights (saturation=%.1f%%)', satRatio * 100);
    elseif strcmp(illumStatus, 'UNEVEN')
        reasons{end + 1} = sprintf('Uneven illumination across fundus field (CV=%.2f)', unevenCV);
    end

    if rawP95_5 < qcfg.hard_fail.min_contrast_p95_5
        reasons{end + 1} = 'Critically low dynamic range / flat contrast';
    elseif strcmp(contrastStatus, 'LOW_CONTRAST')
        reasons{end + 1} = 'Suboptimal retinal contrast';
    end

    if rawFovArea < qcfg.hard_fail.min_fov_ratio
        reasons{end + 1} = sprintf('Restricted field of view (%.1f%% visible)', rawFovArea * 100);
    elseif strcmp(fovStatus, 'BORDERLINE')
        reasons{end + 1} = sprintf('Partial aperture clipping (%.1f%% visible)', rawFovArea * 100);
    end

    if satRatio >= qcfg.hard_fail.max_saturation
        reasons{end + 1} = sprintf('Severe highlight saturation (>%.0f%% of retina clipped)', qcfg.hard_fail.max_saturation * 100);
    end

    if isempty(reasons)
        reasons = {'Image quality is sufficient for clinical AI evaluation'};
    end

    % Determine Final Categorical Status
    isHardFail = (rawFovArea < qcfg.hard_fail.min_fov_ratio) || ...
                 (rawLapVar < qcfg.hard_fail.min_focus_lapvar) || ...
                 (rawP95_5 < qcfg.hard_fail.min_contrast_p95_5) || ...
                 (satRatio >= qcfg.hard_fail.max_saturation) || ...
                 (rawMeanBrightness < qcfg.hard_fail.min_mean_brightness);

    if isHardFail || overallScore < qcfg.decision.thresh_borderline
        overallStatus = 'UNGRADABLE';
        isAcceptable = false;
    elseif overallScore >= qcfg.decision.thresh_good
        overallStatus = 'GOOD';
        isAcceptable = true;
    else
        overallStatus = 'BORDERLINE';
        isAcceptable = true;
    end

    %% 8. Assemble Output Structure
    quality = struct();
    quality.status       = overallStatus;
    quality.overallScore = round(overallScore, 4);

    quality.focus = struct( ...
        'score',     round(focusScore, 4), ...
        'rawMetric', round(rawLapVar, 4), ...
        'status',    focusStatus ...
    );

    quality.illumination = struct( ...
        'score',     round(illumScore, 4), ...
        'rawMetric', round(rawMeanBrightness, 4), ...
        'status',    illumStatus ...
    );

    quality.contrast = struct( ...
        'score',     round(contrastScore, 4), ...
        'rawMetric', round(rawP95_5, 4), ...
        'status',    contrastStatus ...
    );

    quality.fov = struct( ...
        'score',     round(fovScore, 4), ...
        'rawMetric', round(rawFovArea, 4), ...
        'status',    fovStatus ...
    );

    quality.reasons = reasons;

    % Substruct for Blueprint backward compatibility
    quality.scores = struct( ...
        'focus',         round(focusScore, 4), ...
        'illumination',  round(illumScore, 4), ...
        'contrast',      round(contrastScore, 4), ...
        'field_of_view', round(fovScore, 4), ...
        'FOV',           round(fovScore, 4), ...
        'blur',          round(1.0 - focusScore, 4), ...
        'overall',       round(overallScore, 4) ...
    );

    % Optional mask payload for debugging/visualization
    if nargout >= 3
        maskData = struct();
        maskData.fovMask = fovMask;
        maskData.erodedMask = erodedMask;
        maskData.rawFovArea = rawFovArea;
        maskData.satRatio = satRatio;
        maskData.darkRatio = darkRatio;
        maskData.unevenCV = unevenCV;
    end

end
