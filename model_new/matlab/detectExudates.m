function result = detectExudates(image, opticDisc, config)
%DETECTEXUDATES Detect bright candidate regions while masking optic disc.
% These are image-analysis candidates, not clinical detections.

if nargin < 3 || isempty(config)
    config = defaultRetinalConfig();
end

rgb = im2double(image);
lab = rgb2lab(rgb);
lightness = mat2gray(lab(:, :, 1));
bright = lightness > 0.82;
bright = imclose(bright, strel('disk', 2));
bright = imfill(bright, 'holes');
bright = bwareaopen(bright, config.lesions.minExudateArea);

if isfield(opticDisc, 'mask') && ~isempty(opticDisc.mask)
    bright(opticDisc.mask) = false;
end

objects = regionprops(bright, 'Area', 'Centroid', 'BoundingBox');
keep = [objects.Area] >= config.lesions.minExudateArea & ...
    [objects.Area] <= config.lesions.maxComponentArea;
locations = zeros(0, 2);
if any(keep)
    locations = reshape([objects(keep).Centroid], 2, []).';
end
result = struct('candidate_count', nnz(keep), ...
    'area_pixels', sum([objects(keep).Area]), ...
    'locations', {locations}, ...
    'mask', bright, 'method', "bright-region candidate analysis with optic-disc mask");
end