function fundus = checkFundusImage(inputImg, cfg)
% CHECKFUNDUSIMAGE Screen input image for genuine retinal fundus characteristics
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   fundus = checkFundusImage(inputImg)
%   fundus = checkFundusImage(inputImg, cfg)
%
% Inputs:
%   inputImg - File path string OR RGB image matrix (uint8 / double)
%   cfg      - (Optional) Configuration struct from model_config() or fundus_config()
%
% Outputs:
%   fundus   - Struct conforming to project blueprint:
%              .isFundus   - Logical flag (true only if status is 'FUNDUS')
%              .confidence - Confidence in categorization [0.0, 1.0]
%              .status     - 'FUNDUS' | 'NON_FUNDUS' | 'UNCERTAIN'
%              .score      - Composite fundus likelihood score [0.0, 1.0]
%              .reasons    - Cell array of strings detailing screening findings
%              .method     - Algorithm description string
%              .features   - Substruct containing all measured optical/morphological metrics
%
% Clinical & Regulatory Safety Gate:
%   Acts as Stage 0 input-domain screening. Non-fundus and uncertain inputs are
%   safely rejected before Quality Assessment, Enhancement, EfficientNet DR
%   inference, Grad-CAM, or clinical reporting.

    %% 1. Configuration Resolution
    if nargin < 2 || isempty(cfg)
        cfg = model_config();
        fcfg = cfg.fundus;
    elseif isfield(cfg, 'fundus')
        fcfg = cfg.fundus;
    else
        fcfg = cfg;
    end

    %% 2. Image Ingestion (Native Resolution Preserved)
    if ischar(inputImg) || isstring(inputImg)
        if ~isfile(inputImg)
            error('checkFundusImage:FileNotFound', 'Image file not found: %s', inputImg);
        end
        img = imread(char(inputImg));
    else
        img = inputImg;
    end

    if isempty(img)
        error('checkFundusImage:EmptyInput', 'Input image cannot be empty.');
    end

    % Ensure 3-channel RGB uint8 representation
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

    [imgH, imgW, ~] = size(rgbImg);
    totalPixels = imgH * imgW;
    dblGray = double(rgb2gray(rgbImg));
    R = double(rgbImg(:, :, 1));
    G = double(rgbImg(:, :, 2));
    B = double(rgbImg(:, :, 3));

    %% 3. Candidate Field of View (FOV) Segmentation
    maxCh = max(rgbImg, [], 3);
    smoothMax = imgaussfilt(double(maxCh), fcfg.fov.smoothing_sigma);
    rawMask = smoothMax > fcfg.fov.intensity_thresh;
    rawMask = imfill(rawMask, 'holes');

    cc = bwconncomp(rawMask);
    if cc.NumObjects > 0
        areas = cellfun(@numel, cc.PixelIdxList);
        [~, maxIdx] = max(areas);
        fovMask = false(size(rawMask));
        fovMask(cc.PixelIdxList{maxIdx}) = true;
    else
        fovMask = true(imgH, imgW);
    end

    fovAreaRatio = sum(fovMask(:)) / double(totalPixels);
    props = regionprops(fovMask, 'Circularity', 'Solidity');
    if ~isempty(props)
        circ = props(1).Circularity;
        sol = props(1).Solidity;
    else
        circ = 0; sol = 0;
    end

    % Eroded FOV for interior tissue evaluation (avoids camera aperture rim)
    erodedFov = imerode(fovMask, strel('disk', fcfg.fov.erosion_disk_radius));
    if ~any(erodedFov(:))
        erodedFov = fovMask;
    end
    numFovPixels = max(1, sum(erodedFov(:)));

    %% 4. Feature 1: Background Aperture Border Analysis
    mH = max(1, round(fcfg.border.margin_ratio * imgH));
    mW = max(1, round(fcfg.border.margin_ratio * imgW));
    borderMask = false(imgH, imgW);
    borderMask(1:mH, :) = true;
    borderMask(end-mH+1:end, :) = true;
    borderMask(:, 1:mW) = true;
    borderMask(:, end-mW+1:end) = true;
    borderMean = mean(dblGray(borderMask));

    % Masked camera vs rectangular sensor crop
    isFullFrame = (fovAreaRatio >= fcfg.fov.full_frame_ratio);
    if isFullFrame
        % Full rectangular crop: border contains retinal tissue, not camera stop
        borderScore = max(0.0, 1.0 - max(0.0, borderMean - 80.0) / 40.0);
        isBorderValid = (borderMean < fcfg.border.max_border_mean);
    else
        % Circular masked fundus: border must be dark camera stop
        isDarkBorder = (borderMean <= fcfg.border.dark_border_thresh);
        isGeomValid  = (circ >= fcfg.border.min_circularity || sol >= fcfg.border.min_solidity);
        isBorderValid = isDarkBorder && isGeomValid && (borderMean < fcfg.border.max_border_mean);
        borderScore = 0.5 * max(0.0, 1.0 - borderMean / fcfg.border.dark_border_thresh) + ...
                      0.5 * min(1.0, circ / fcfg.border.min_circularity);
    end
    borderScore = min(1.0, max(0.0, borderScore));

    %% 5. Feature 2: Retinal Chromaticity & Spectral Profile
    fovR = R(erodedFov);
    fovG = G(erodedFov);
    fovB = B(erodedFov);

    meanR_fov = mean(fovR);
    meanG_fov = mean(fovG);
    meanB_fov = mean(fovB);

    rgRatio = meanR_fov / max(1.0, meanG_fov);
    rbRatio = meanR_fov / max(1.0, meanB_fov);
    gbRatio = meanG_fov / max(1.0, meanB_fov);

    % Unnatural crimson/synthetic pixels (G < 10 while R > 50)
    deepRedRatio = sum(fovR > 50 & fovG < 10) / numFovPixels;

    % HSV color representation
    hsv = rgb2hsv(rgbImg);
    H_fov = hsv(:, :, 1); H_fov = H_fov(erodedFov);
    S_fov = hsv(:, :, 2); S_fov = S_fov(erodedFov);
    meanSat = mean(S_fov);

    % Orange-red retinal hue fraction: [0, 0.13] or [0.94, 1.0] with saturation >= 0.20
    isRetinalHue = ((H_fov <= 0.13 | H_fov >= 0.94) & (S_fov >= 0.20));
    retinalHueRatio = sum(isRetinalHue(:)) / numFovPixels;

    % Color validity checks
    isColorValid = (rgRatio >= fcfg.color.rg_ratio_min && rgRatio <= fcfg.color.rg_ratio_max) && ...
                   (gbRatio >= fcfg.color.gb_ratio_min) && ...
                   (rbRatio >= fcfg.color.rb_ratio_min) && ...
                   (meanSat >= fcfg.color.min_saturation) && ...
                   (deepRedRatio <= fcfg.color.max_deep_red_ratio) && ...
                   (retinalHueRatio >= fcfg.color.min_retinal_hue_ratio);

    colorScore = 0.30 * min(1.0, max(0.0, (rgRatio - 1.0) / (fcfg.color.rg_ratio_min - 1.0))) + ...
                 0.30 * min(1.0, max(0.0, (gbRatio - 1.0) / (fcfg.color.gb_ratio_min - 1.0))) + ...
                 0.20 * min(1.0, max(0.0, (rbRatio - 1.0) / (fcfg.color.rb_ratio_min - 1.0))) + ...
                 0.20 * min(1.0, retinalHueRatio / fcfg.color.min_retinal_hue_ratio);
    colorScore = min(1.0, max(0.0, colorScore));
    if ~isColorValid
        colorScore = min(colorScore, 0.50);
    end

    %% 6. Feature 3: Retinal Parenchyma Texture & Smoothness
    hFilt = fspecial('average', fcfg.parenchyma.filter_size);
    meanG_loc = imfilter(G, hFilt, 'replicate');
    meanG2_loc = imfilter(G.^2, hFilt, 'replicate');
    localStd = sqrt(max(0, meanG2_loc - meanG_loc.^2));

    medLocalStd = median(localStd(erodedFov));
    smoothFraction = sum(localStd(erodedFov) < fcfg.parenchyma.local_std_smooth_limit) / numFovPixels;

    isParenchymaValid = (medLocalStd >= fcfg.parenchyma.min_median_local_std) && ...
                        (medLocalStd <= fcfg.parenchyma.max_median_local_std) && ...
                        (smoothFraction >= fcfg.parenchyma.min_smooth_fraction);

    if medLocalStd < fcfg.parenchyma.min_median_local_std
        parenchymaScore = 0.05; % Artificial flat disc
    elseif medLocalStd > fcfg.parenchyma.max_median_local_std
        parenchymaScore = 0.00; % Coarse grain/wood surface
    else
        parenchymaScore = min(1.0, smoothFraction / fcfg.parenchyma.min_smooth_fraction);
    end

    %% 7. Feature 4: Retinal Vascular Network & Tubular Line Structures
    invG = 255.0 - G;
    vesselMap = zeros(imgH, imgW);
    for theta = fcfg.vessels.orientations
        se = strel('line', fcfg.vessels.line_length, theta);
        vesselMap = max(vesselMap, imtophat(invG, se));
    end

    vesselP90 = prctile(vesselMap(erodedFov), 90);
    vesselBinary = (vesselMap >= fcfg.vessels.intensity_thresh) & erodedFov;
    vesselCC = bwconncomp(vesselBinary);
    vesselLengths = cellfun(@numel, vesselCC.PixelIdxList);
    longVesselPixels = sum(vesselLengths(vesselLengths >= fcfg.vessels.min_branch_length));

    isVesselsValid = (vesselP90 >= fcfg.vessels.min_p90_response) && ...
                     (longVesselPixels >= fcfg.vessels.min_long_vessel_pixels);

    if longVesselPixels == 0 && vesselP90 < 1.0
        vesselScore = 0.0;
    else
        vesselScore = 0.50 * min(1.0, vesselP90 / fcfg.vessels.min_p90_response) + ...
                      0.50 * min(1.0, longVesselPixels / fcfg.vessels.min_long_vessel_pixels);
    end
    vesselScore = min(1.0, max(0.0, vesselScore));

    %% 8. Hard Negative Exclusion Rules (Immediate Non-Fundus Disqualification)
    hardFailReasons = {};

    % Rule 1: Achromatic / Grayscale
    if meanSat < 0.12 || rbRatio < 1.15
        hardFailReasons{end + 1} = 'Achromatic / grayscale content (lacks retinal chromophores)';
    end

    % Rule 2: Bright background border (watermelon / cutouts)
    if borderMean > fcfg.border.max_border_mean
        hardFailReasons{end + 1} = sprintf('Bright background border (mean intensity %.1f > %.1f), non-fundus lighting', ...
            borderMean, fcfg.border.max_border_mean);
    end

    % Rule 3: Featureless synthetic graphic
    if medLocalStd < fcfg.parenchyma.min_median_local_std && longVesselPixels == 0
        hardFailReasons{end + 1} = 'Synthetic featureless flat graphic (zero vessels, zero physiological variance)';
    end

    % Rule 4: Coarse non-biological texture (wood, canvas, textile)
    if medLocalStd > fcfg.parenchyma.max_median_local_std || smoothFraction < 0.15
        hardFailReasons{end + 1} = sprintf('Coarse non-biological surface (median local std = %.1f, smooth parenchyma = %.1f%%)', ...
            medLocalStd, smoothFraction * 100);
    end

    % Rule 5: Non-physiological crimson spectrum or irregular geometry
    if deepRedRatio > fcfg.color.max_deep_red_ratio || (circ < 0.55 && ~isFullFrame && gbRatio < 1.25)
        hardFailReasons{end + 1} = sprintf('Non-physiological spectral profile / irregular geometry (G<10 in %.1f%% of tissue, circ=%.2f)', ...
            deepRedRatio * 100, circ);
    end

    %% 9. Composite Scoring and Decision Gate
    compositeScore = fcfg.weights.color      * colorScore + ...
                     fcfg.weights.border     * borderScore + ...
                     fcfg.weights.parenchyma * parenchymaScore + ...
                     fcfg.weights.vessels    * vesselScore;
    compositeScore = round(compositeScore, 4);

    hasHardFail = ~isempty(hardFailReasons);
    allGatesPassed = isColorValid && isBorderValid && isParenchymaValid && isVesselsValid;

    if hasHardFail
        status = 'NON_FUNDUS';
        isFundus = false;
        confidence = round(max(0.70, 1.0 - compositeScore), 4);
        reasons = hardFailReasons;
    elseif allGatesPassed && compositeScore >= fcfg.decision.thresh_fundus
        status = 'FUNDUS';
        isFundus = true;
        confidence = round(compositeScore, 4);
        reasons = {'All retinal morphological and optical characteristics verified'};
    elseif compositeScore <= fcfg.decision.thresh_non_fundus
        status = 'NON_FUNDUS';
        isFundus = false;
        confidence = round(1.0 - compositeScore, 4);
        reasons = {'Insufficient fundus likelihood across multiple optical domains'};
    else
        status = 'UNCERTAIN';
        isFundus = false;
        confidence = 0.5000;
        reasons = {'Ambiguous fundus characteristics; flagged for safe clinical review'};
    end

    %% 10. Assemble Output Structure
    fundus = struct();
    fundus.isFundus   = isFundus;
    fundus.confidence = confidence;
    fundus.status     = status;
    fundus.score      = compositeScore;
    fundus.reasons    = reasons;
    fundus.method     = 'Multiscale Morphological & Spectral Validity Screening';

    fundus.features = struct();
    fundus.features.color = struct( ...
        'score',            round(colorScore, 4), ...
        'isValid',          isColorValid, ...
        'rgRatio',          round(rgRatio, 3), ...
        'gbRatio',          round(gbRatio, 3), ...
        'rbRatio',          round(rbRatio, 3), ...
        'meanSaturation',   round(meanSat, 3), ...
        'retinalHueRatio',  round(retinalHueRatio, 3), ...
        'deepRedRatio',     round(deepRedRatio, 3) ...
    );

    fundus.features.border = struct( ...
        'score',            round(borderScore, 4), ...
        'isValid',          isBorderValid, ...
        'borderMean',       round(borderMean, 2), ...
        'fovAreaRatio',     round(fovAreaRatio, 3), ...
        'circularity',      round(circ, 3), ...
        'solidity',         round(sol, 3), ...
        'isFullFrame',      isFullFrame ...
    );

    fundus.features.parenchyma = struct( ...
        'score',            round(parenchymaScore, 4), ...
        'isValid',          isParenchymaValid, ...
        'medianLocalStd',   round(medLocalStd, 3), ...
        'smoothFraction',   round(smoothFraction, 3) ...
    );

    fundus.features.vessels = struct( ...
        'score',            round(vesselScore, 4), ...
        'isValid',          isVesselsValid, ...
        'vesselP90',        round(vesselP90, 2), ...
        'longVesselPixels', longVesselPixels ...
    );

    fundus.features.fovMask = fovMask;
    fundus.features.erodedFov = erodedFov;
    fundus.features.vesselMap = vesselMap;

end
