function enhancement = enhanceFundus(image, quality, config)
%ENHANCEFUNDUS Apply conservative enhancement only when quality requires it.

if nargin < 3 || isempty(config)
    config = defaultRetinalConfig();
end

original = im2uint8(image);
enhancement = struct('applied', false, ...
    'reason', "Quality status does not require enhancement.", ...
    'original', original, 'image', original);

if strcmp(quality.status, 'INSUFFICIENT')
    enhancement.reason = "Image rejected; enhancement must not hide severe quality failure.";
    enhancement.metrics = compareEnhancement(original, original);
    return;
end

if strcmp(quality.status, 'GOOD')
    enhancement.metrics = compareEnhancement(original, original);
    return;
end

rgb = im2double(original);
gray = im2gray(rgb);
background = imgaussfilt(gray, config.enhancement.backgroundSigma);
corrected = mat2gray(gray - background + mean(background(:)));

lab = rgb2lab(rgb);
lab(:, :, 1) = adapthisteq(lab(:, :, 1) / 100, ...
    'ClipLimit', config.enhancement.claheClipLimit) * 100;
enhanced = lab2rgb(lab);

% Blend luminance correction with color-preserving CLAHE output.
enhancedGray = adapthisteq(corrected, ...
    'ClipLimit', config.enhancement.claheClipLimit);
enhanced = replaceLuminance(enhanced, enhancedGray);
for channel = 1:size(enhanced, 3)
    enhanced(:, :, channel) = medfilt2(...
        enhanced(:, :, channel), config.enhancement.medianWindow, 'symmetric');
end
enhanced = imsharpen(enhanced, 'Radius', config.enhancement.unsharpRadius, ...
    'Amount', config.enhancement.unsharpAmount);
enhanced = min(max(enhanced, 0), 1);

enhancement.applied = true;
enhancement.reason = "Conservative illumination, contrast, denoising, and sharpening applied.";
enhancement.image = im2uint8(enhanced);
enhancement.metrics = compareEnhancement(original, enhancement.image);
end

function output = replaceLuminance(rgb, luminance)
lab = rgb2lab(rgb);
lab(:, :, 1) = luminance * 100;
output = lab2rgb(lab);
end

function metrics = compareEnhancement(original, enhanced)
originalGray = im2double(im2gray(original));
enhancedGray = im2double(im2gray(enhanced));
metrics = struct('original_brightness', mean(originalGray(:)) * 255, ...
    'enhanced_brightness', mean(enhancedGray(:)) * 255, ...
    'original_contrast', std(originalGray(:)) * 255, ...
    'enhanced_contrast', std(enhancedGray(:)) * 255, ...
    'original_sharpness', sharpness(originalGray), ...
    'enhanced_sharpness', sharpness(enhancedGray));
end

function value = sharpness(gray)
laplacian = imfilter(gray, [0 1 0; 1 -4 1; 0 1 0], 'replicate');
value = var(laplacian(:)) * 255^2;
end
