function fig = visualizeEnhancement(inputImg, cfg, savePath)
% VISUALIZEENHANCEMENT Visual debug display for Stage 2 borderline fundus enhancement
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   fig = visualizeEnhancement(inputImg)
%   fig = visualizeEnhancement(inputImg, cfg)
%   fig = visualizeEnhancement(inputImg, cfg, savePath)
%
% Displays:
%   Panel 1: Original RGB Fundus Image
%   Panel 2: Enhanced RGB Fundus Image (or original if enhancement was bypassed)
%   Panel 3: Difference / Enhancement Effect (magnified visual delta)
%   Panel 4: Before vs After Quality Metrics Scorecard

    if nargin < 2 || isempty(cfg)
        cfg = model_config();
    end

    if ischar(inputImg) || isstring(inputImg)
        [~, imgName, ext] = fileparts(char(inputImg));
        titleStr = [imgName, ext];
    else
        titleStr = 'In-Memory Fundus Image';
    end

    enh = enhanceBorderline(inputImg, cfg);

    fig = figure('Name', ['Stage 2 Enhancement - ', titleStr], ...
                 'NumberTitle', 'off', ...
                 'Position', [100, 100, 1150, 750], ...
                 'Visible', 'off');

    % Panel 1: Original Image
    subplot(2, 2, 1);
    imshow(enh.originalImage);
    title(sprintf('Panel 1: Original Fundus\nStatus: %s (Score: %.3f)', ...
          enh.beforeQuality.status, enh.beforeQuality.overallScore), ...
          'FontSize', 11, 'FontWeight', 'bold');

    % Panel 2: Enhanced Image
    subplot(2, 2, 2);
    imshow(enh.enhancedImage);
    if enh.applied
        title(sprintf('Panel 2: Enhanced Fundus (Applied)\nStatus: %s (Score: %.3f)', ...
              enh.afterQuality.status, enh.afterQuality.overallScore), ...
              'FontSize', 11, 'FontWeight', 'bold');
    else
        title(sprintf('Panel 2: Enhanced Image (BYPASSED)\nStatus: %s (Unchanged)', ...
              enh.beforeQuality.status), ...
              'FontSize', 11, 'FontWeight', 'bold');
    end

    % Panel 3: Difference / Enhancement Effect
    subplot(2, 2, 3);
    if enh.applied
        % Absolute difference amplified 3x for clear visual inspection
        diffImg = abs(single(enh.enhancedImage) - single(enh.originalImage));
        amplifiedDiff = uint8(min(255, diffImg * 3.0));
        imshow(amplifiedDiff);
        title('Panel 3: Enhancement Delta (|Enhanced - Orig| x 3)', ...
              'FontSize', 11, 'FontWeight', 'bold');
    else
        imshow(zeros(size(enh.originalImage), 'uint8'));
        text(0.5, 0.5, sprintf('Enhancement Bypassed\n(Status was %s)', enh.beforeQuality.status), ...
             'Color', 'w', 'HorizontalAlignment', 'center', ...
             'FontSize', 12, 'FontWeight', 'bold', 'Units', 'normalized');
        title('Panel 3: Enhancement Effect (None)', 'FontSize', 11, 'FontWeight', 'bold');
    end

    % Panel 4: Before vs After Quality Scorecard
    subplot(2, 2, 4);
    axis off;

    qB = enh.beforeQuality;
    qA = enh.afterQuality;

    scorecard = { ...
        sprintf('\\bf\\fontsize{13}Stage 2 Enhancement Report: %s', titleStr), ...
        sprintf('\\fontsize{11}Enhancement Applied: \\bf%s', mat2str(enh.applied)), ...
        sprintf('\\fontsize{11}Quality Improved   : \\bf%s', mat2str(enh.improved)), ...
        '', ...
        '\\bf\\fontsize{11}Quality Comparison (Before \\rightarrow After):', ...
        sprintf('  \\bullet Overall Status : %s \\rightarrow %s', qB.status, qA.status), ...
        sprintf('  \\bullet Overall Score  : %.3f \\rightarrow %.3f (\\Delta = %+.3f)', ...
                qB.overallScore, qA.overallScore, qA.overallScore - qB.overallScore), ...
        sprintf('  \\bullet Focus LapVar   : %.2f (%s) \\rightarrow %.2f (%s)', ...
                qB.focus.rawMetric, qB.focus.status, qA.focus.rawMetric, qA.focus.status), ...
        sprintf('  \\bullet Illumination   : Mean=%.1f (%s) \\rightarrow Mean=%.1f (%s)', ...
                qB.illumination.rawMetric, qB.illumination.status, ...
                qA.illumination.rawMetric, qA.illumination.status), ...
        sprintf('  \\bullet Contrast P95-5 : %.1f (%s) \\rightarrow %.1f (%s)', ...
                qB.contrast.rawMetric, qB.contrast.status, ...
                qA.contrast.rawMetric, qA.contrast.status), ...
        '', ...
        '\\bf\\fontsize{11}Decision Log / Operational Reasons:' ...
    };

    for r = 1:numel(enh.reasons)
        scorecard{end + 1} = sprintf('   - %s', enh.reasons{r}); %#ok<AGROW>
    end

    text(0.05, 0.95, scorecard, 'Interpreter', 'tex', ...
         'VerticalAlignment', 'top', 'FontSize', 9.5);

    if nargin >= 3 && ~isempty(savePath)
        saveas(fig, savePath);
    end

end
