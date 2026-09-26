function figHandle = visualizeFundusCheck(inputImg, outputPath, cfg)
% VISUALIZEFUNDUSCHECK Diagnostic 4-panel visualization for Stage 0 Fundus Validation
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   figHandle = visualizeFundusCheck(inputImg)
%   figHandle = visualizeFundusCheck(inputImg, outputPath)
%   figHandle = visualizeFundusCheck(inputImg, outputPath, cfg)
%
% Inputs:
%   inputImg   - File path string OR RGB image matrix (uint8 / double)
%   outputPath - (Optional) Destination PNG path to save the diagnostic figure
%   cfg        - (Optional) Configuration struct
%
% Outputs:
%   figHandle  - Handle to generated invisible/visible figure
%
% Visualization Layout (4 Panels):
%   Panel 1: Original Image
%   Panel 2: Detected Candidate FOV (with boundary contour overlay)
%   Panel 3: Anatomical Vascular & Texture Feature Map
%   Panel 4: Fundus Validity Scorecard (Metrics, Status, Reasons)

    %% 1. Configuration & Input Resolution
    if nargin < 3 || isempty(cfg)
        cfg = model_config();
    end

    if ischar(inputImg) || isstring(inputImg)
        [~, imgBase, imgExt] = fileparts(inputImg);
        imgName = [imgBase, imgExt];
        img = imread(char(inputImg));
    else
        imgName = 'In-Memory Array';
        img = inputImg;
    end

    if ndims(img) == 2
        rgbImg = repmat(img, [1, 1, 3]);
    elseif size(img, 3) > 3
        rgbImg = img(:, :, 1:3);
    else
        rgbImg = img;
    end
    if ~isa(rgbImg, 'uint8')
        rgbImg = uint8(round(rgbImg));
    end

    %% 2. Run Fundus Screening
    fundus = checkFundusImage(rgbImg, cfg);
    feats = fundus.features;

    %% 3. Create Diagnostic Figure
    figHandle = figure('Name', sprintf('Stage 0 Fundus Screening: %s', imgName), ...
        'Position', [100, 100, 1300, 850], ...
        'Color', [0.08, 0.10, 0.14], ...
        'Visible', 'off');

    % --- Panel 1: Original Image ---
    subplot(2, 2, 1);
    imshow(rgbImg);
    title(sprintf('Panel 1: Input Image [%s]', imgName), ...
        'Color', [0.95, 0.95, 0.98], 'FontSize', 12, 'FontWeight', 'bold');

    % --- Panel 2: Candidate FOV Mask with Boundary Overlay ---
    subplot(2, 2, 2);
    fovMask = feats.fovMask;
    fovOverlay = rgbImg;
    fovBound = bwperim(fovMask);
    fovBoundDil = imdilate(fovBound, strel('disk', 2));
    
    rCh = fovOverlay(:,:,1); gCh = fovOverlay(:,:,2); bCh = fovOverlay(:,:,3);
    rCh(fovBoundDil) = 0; gCh(fovBoundDil) = 255; bCh(fovBoundDil) = 255; % Cyan boundary
    fovOverlay(:,:,1) = rCh; fovOverlay(:,:,2) = gCh; fovOverlay(:,:,3) = bCh;
    
    imshow(fovOverlay);
    geomTitle = sprintf('Panel 2: Candidate FOV (Area=%.1f%%, Circ=%.2f)', ...
        feats.border.fovAreaRatio * 100, feats.border.circularity);
    title(geomTitle, 'Color', [0.95, 0.95, 0.98], 'FontSize', 12, 'FontWeight', 'bold');

    % --- Panel 3: Vascular Tree & Texture Feature Map ---
    subplot(2, 2, 3);
    vesselMap = feats.vesselMap;
    normVessels = vesselMap / max(1.0, max(vesselMap(:)));
    vesselHeat = ind2rgb(uint8(round(normVessels * 255)), jet(256));
    imshow(vesselHeat);
    vesselTitle = sprintf('Panel 3: Vascular Response (P90=%.1f, LongPix=%d)', ...
        feats.vessels.vesselP90, feats.vessels.longVesselPixels);
    title(vesselTitle, 'Color', [0.95, 0.95, 0.98], 'FontSize', 12, 'FontWeight', 'bold');

    % --- Panel 4: Validity Scorecard ---
    subplot(2, 2, 4);
    ax = gca;
    cla(ax);
    set(ax, 'Color', [0.12, 0.15, 0.20], 'XTick', [], 'YTick', [], ...
        'XColor', [0.25, 0.30, 0.40], 'YColor', [0.25, 0.30, 0.40], 'Box', 'on');
    hold(ax, 'on');

    % Status styling
    switch fundus.status
        case 'FUNDUS'
            statusColor = [0.15, 0.85, 0.45]; % Vibrant emerald green
            badgeText   = 'STATUS: FUNDUS (PASSED STAGE 0)';
            actionText  = 'Clinical Action: Proceed to Quality Assessment';
        case 'NON_FUNDUS'
            statusColor = [0.95, 0.25, 0.25]; % Red
            badgeText   = 'STATUS: NON-FUNDUS (REJECTED)';
            actionText  = 'Clinical Action: Immediate Rejection / Alert User';
        case 'UNCERTAIN'
            statusColor = [0.95, 0.75, 0.15]; % Amber
            badgeText   = 'STATUS: UNCERTAIN (SAFE REJECTION)';
            actionText  = 'Clinical Action: Route to Human Specialist Review';
    end

    text(0.05, 0.92, badgeText, 'Color', statusColor, ...
        'FontSize', 14, 'FontWeight', 'bold', 'Units', 'normalized');
    text(0.05, 0.84, actionText, 'Color', [0.85, 0.85, 0.90], ...
        'FontSize', 10, 'FontAngle', 'italic', 'Units', 'normalized');

    text(0.05, 0.74, sprintf('Composite Likelihood Score: %.3f', fundus.score), ...
        'Color', [1.0, 1.0, 1.0], 'FontSize', 11, 'FontWeight', 'bold', 'Units', 'normalized');
    text(0.05, 0.67, sprintf('Gate Confidence: %.1f%%', fundus.confidence * 100), ...
        'Color', [0.80, 0.85, 0.95], 'FontSize', 10, 'Units', 'normalized');

    % Metrics list
    cVal = feats.color;
    bVal = feats.border;
    pVal = feats.parenchyma;
    vVal = feats.vessels;

    yPos = 0.58;
    colorStr = sprintf('Spectral Profile: Score=%.2f | R/G=%.2f, G/B=%.2f, R/B=%.2f', ...
        cVal.score, cVal.rgRatio, cVal.gbRatio, cVal.rbRatio);
    text(0.05, yPos, colorStr, 'Color', [0.80, 0.80, 0.85], 'FontSize', 9, 'Units', 'normalized');

    yPos = yPos - 0.08;
    borderStr = sprintf('Aperture Border: Score=%.2f | BorderMean=%.1f, Circ=%.2f', ...
        bVal.score, bVal.borderMean, bVal.circularity);
    text(0.05, yPos, borderStr, 'Color', [0.80, 0.80, 0.85], 'FontSize', 9, 'Units', 'normalized');

    yPos = yPos - 0.08;
    parenStr = sprintf('Parenchyma: Score=%.2f | LocalStd=%.2f, Smooth=%.1f%%', ...
        pVal.score, pVal.medianLocalStd, pVal.smoothFraction * 100);
    text(0.05, yPos, parenStr, 'Color', [0.80, 0.80, 0.85], 'FontSize', 9, 'Units', 'normalized');

    yPos = yPos - 0.08;
    vessStr = sprintf('Vessel Network: Score=%.2f | P90=%.1f, LongPix=%d', ...
        vVal.score, vVal.vesselP90, vVal.longVesselPixels);
    text(0.05, yPos, vessStr, 'Color', [0.80, 0.80, 0.85], 'FontSize', 9, 'Units', 'normalized');

    % Reasons
    yPos = yPos - 0.10;
    text(0.05, yPos, 'Diagnostic Findings:', 'Color', [1.0, 0.85, 0.40], ...
        'FontSize', 10, 'FontWeight', 'bold', 'Units', 'normalized');
    for r = 1:min(2, numel(fundus.reasons))
        yPos = yPos - 0.07;
        text(0.08, yPos, ['- ', fundus.reasons{r}], 'Color', [0.90, 0.90, 0.95], ...
            'FontSize', 8.5, 'Units', 'normalized');
    end

    title('Panel 4: Stage 0 Validity Scorecard', ...
        'Color', [0.95, 0.95, 0.98], 'FontSize', 12, 'FontWeight', 'bold');

    drawnow;

    %% 4. Save to Disk if Output Path Specified
    if nargin >= 2 && ~isempty(outputPath)
        outDir = fileparts(outputPath);
        if ~isempty(outDir) && ~exist(outDir, 'dir')
            mkdir(outDir);
        end
        exportgraphics(figHandle, outputPath, 'Resolution', 150);
        fprintf('Saved Stage 0 fundus visualization to: %s\n', outputPath);
    end

end
