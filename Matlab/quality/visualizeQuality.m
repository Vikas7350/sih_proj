function fig = visualizeQuality(inputImg, cfg, savePath)
% VISUALIZEQUALITY Debug visualization for retinal image quality assessment
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   fig = visualizeQuality(inputImg)
%   fig = visualizeQuality(inputImg, cfg)
%   fig = visualizeQuality(inputImg, cfg, savePath)
%
% Displays:
%   1. Original RGB Fundus Image
%   2. Segmented FOV Mask (with boundary contour overlay)
%   3. Grayscale analysis representation inside FOV
%   4. Quality Metrics Scorecard & Diagnostic Status

    if nargin < 2 || isempty(cfg)
        cfg = model_config();
    end

    if ischar(inputImg) || isstring(inputImg)
        img = imread(char(inputImg));
        [~, imgName, ext] = fileparts(char(inputImg));
        titleStr = [imgName, ext];
    else
        img = inputImg;
        titleStr = 'In-Memory Image';
    end

    [quality, ~, maskData] = assessQuality(img, cfg);

    fig = figure('Name', ['Quality Assessment - ', titleStr], ...
                 'NumberTitle', 'off', ...
                 'Position', [100, 100, 1100, 750], ...
                 'Visible', 'off');

    % 1. Original Image
    subplot(2, 2, 1);
    imshow(img);
    title(sprintf('Original Fundus: %s\nSize: %dx%d', titleStr, size(img,1), size(img,2)), ...
          'FontSize', 11, 'FontWeight', 'bold');

    % 2. FOV Mask Overlay
    subplot(2, 2, 2);
    imshow(img);
    hold on;
    % Overlay contour of FOV mask in bright cyan
    boundaries = bwboundaries(maskData.fovMask);
    for k = 1:numel(boundaries)
        boundary = boundaries{k};
        plot(boundary(:,2), boundary(:,1), 'c-', 'LineWidth', 2);
    end
    % Overlay eroded mask boundary in yellow
    erodedBounds = bwboundaries(maskData.erodedMask);
    for k = 1:numel(erodedBounds)
        b = erodedBounds{k};
        plot(b(:,2), b(:,1), 'y--', 'LineWidth', 1);
    end
    hold off;
    title(sprintf('Estimated FOV Mask (Cyan=Aperture, Yellow=Eroded)\nVisible Area: %.1f%%', ...
          quality.fov.rawMetric * 100), 'FontSize', 11, 'FontWeight', 'bold');

    % 3. Grayscale within FOV
    subplot(2, 2, 3);
    gray = rgb2gray(img);
    maskedGray = gray;
    maskedGray(~maskData.fovMask) = 0;
    imshow(maskedGray);
    title('Retinal Field Analysis Representation', 'FontSize', 11, 'FontWeight', 'bold');

    % 4. Metrics Scorecard
    subplot(2, 2, 4);
    axis off;
    
    % Pick status color
    switch quality.status
        case 'GOOD'
            statusColor = [0, 0.6, 0.1]; % Green
        case 'BORDERLINE'
            statusColor = [0.85, 0.5, 0.0]; % Orange
        otherwise
            statusColor = [0.8, 0.1, 0.1]; % Red
    end

    scorecardText = { ...
        sprintf('\\bf\\fontsize{14}Overall Quality Status: {\\color[rgb]{%.2f,%.2f,%.2f}%s}', ...
                statusColor(1), statusColor(2), statusColor(3), quality.status), ...
        sprintf('\\fontsize{12}Overall Quality Score: \\bf%.3f / 1.000', quality.overallScore), ...
        '', ...
        '\\bf\\fontsize{11}Individual Quality Sub-Metrics:', ...
        sprintf('  \\bullet Focus / Sharpness : Score = %.3f (%s, LapVar = %.2f)', ...
                quality.focus.score, quality.focus.status, quality.focus.rawMetric), ...
        sprintf('  \\bullet Illumination     : Score = %.3f (%s, Mean = %.1f, Sat = %.1f%%)', ...
                quality.illumination.score, quality.illumination.status, ...
                quality.illumination.rawMetric, maskData.satRatio * 100), ...
        sprintf('  \\bullet Contrast         : Score = %.3f (%s, P95-5 = %.1f)', ...
                quality.contrast.score, quality.contrast.status, quality.contrast.rawMetric), ...
        sprintf('  \\bullet Field of View    : Score = %.3f (%s, Retinal Area = %.1f%%)', ...
                quality.fov.score, quality.fov.status, quality.fov.rawMetric * 100), ...
        '', ...
        '\\bf\\fontsize{11}Diagnostic Findings / Reasons:' ...
    };

    for r = 1:numel(quality.reasons)
        scorecardText{end + 1} = sprintf('   - %s', quality.reasons{r}); %#ok<AGROW>
    end

    text(0.05, 0.95, scorecardText, 'Interpreter', 'tex', ...
         'VerticalAlignment', 'top', 'FontSize', 10);

    if nargin >= 3 && ~isempty(savePath)
        saveas(fig, savePath);
    end

end
