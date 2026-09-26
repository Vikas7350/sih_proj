function quality = assessQuality(image, config)
%ASSESSQUALITY Assess fundus-image usability with engineering heuristics.
% These thresholds require calibration against expert-labeled image quality.

if nargin < 2 || isempty(config)
    config = defaultRetinalConfig();
end

if size(image, 3) == 1
    rgb = repmat(image, 1, 1, 3);
else
    rgb = image(:, :, 1:3);
end

gray = im2double(im2gray(rgb));
[height, width, ~] = size(rgb);

brightness = mean(gray(:)) * 255;
contrast = std(gray(:)) * 255;
laplacian = imfilter(gray, [0 1 0; 1 -4 1; 0 1 0], 'replicate');
% Scale back to an 8-bit-equivalent variance so the engineering threshold
% remains comparable with the Python quality gate.
sharpness = var(laplacian(:)) * 255^2;

fundusMask = estimateFundusMask(rgb);
visibility = nnz(fundusMask) / numel(fundusMask);

resolutionPass = width >= config.quality.minWidth && ...
    height >= config.quality.minHeight;
brightnessPass = brightness >= config.quality.minBrightness && ...
    brightness <= config.quality.maxBrightness;
contrastPass = contrast >= config.quality.minContrast;
sharpnessPass = sharpness >= config.quality.minSharpness;
visibilityPass = visibility >= config.quality.minFundusVisibility;

resolutionScore = 100 * resolutionPass;
brightnessScore = max(0, 100 - abs(brightness - 128) / 128 * 40);
contrastScore = min(100, contrast / 60 * 100);
sharpnessScore = min(100, sharpness / 200 * 100);
visibilityScore = min(100, visibility * 100);

score = 0.15 * resolutionScore + 0.20 * brightnessScore + ...
    0.20 * contrastScore + 0.25 * sharpnessScore + 0.20 * visibilityScore;

fundamentalPass = resolutionPass && brightnessPass && contrastPass && ...
    sharpnessPass && visibilityPass;
severeFailure = sharpness < config.quality.recaptureSharpness || ...
    visibility < config.quality.recaptureVisibility || ~resolutionPass;

if severeFailure
    status = "INSUFFICIENT";
elseif fundamentalPass && score >= config.quality.enhanceScoreThreshold
    status = "GOOD";
elseif fundamentalPass || score >= 45
    status = "ENHANCE";
else
    status = "INSUFFICIENT";
end

quality = struct();
quality.status = char(status);
quality.quality_score = round(score, 2);
quality.metrics = struct('width', width, 'height', height, ...
    'brightness', round(brightness, 3), 'contrast', round(contrast, 3), ...
    'sharpness', round(sharpness, 3), ...
    'fundus_visibility', round(visibility, 4));
quality.passed = struct('resolution', resolutionPass, ...
    'brightness', brightnessPass, 'contrast', contrastPass, ...
    'sharpness', sharpnessPass, 'fundus_visibility', visibilityPass);
quality.warnings = strings(0, 1);
if ~resolutionPass, quality.warnings(end + 1) = "Resolution is below the engineering minimum."; end
if ~brightnessPass, quality.warnings(end + 1) = "Brightness is outside the engineering range."; end
if ~contrastPass, quality.warnings(end + 1) = "Contrast is below the engineering minimum."; end
if ~sharpnessPass, quality.warnings(end + 1) = "Image may be blurry."; end
if ~visibilityPass, quality.warnings(end + 1) = "Fundus visibility is insufficient."; end
quality.fundus_mask = fundusMask;
end

function mask = estimateFundusMask(rgb)
gray = im2double(im2gray(rgb));
threshold = prctile(gray(:), 20);
mask = gray > threshold;
mask = imclose(mask, strel('disk', 7));
mask = imopen(mask, strel('disk', 5));
mask = bwareafilt(mask, 1);
end