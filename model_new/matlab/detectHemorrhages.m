function result = detectHemorrhages(image, config)
%DETECTHEMORRHAGES Detect dark red candidate regions.
% These are image-analysis candidates, not clinical detections.

if nargin < 2 || isempty(config)
    config = defaultRetinalConfig();
end

rgb = im2double(image);
red = rgb(:, :, 1);
green = rgb(:, :, 2);
redness = red - green;
darkRed = mat2gray(redness) > 0.55 & mat2gray(1 - red) > 0.35;
darkRed = imopen(darkRed, strel('disk', 1));
darkRed = bwareaopen(darkRed, config.lesions.minComponentArea);

objects = regionprops(darkRed, 'Area', 'Centroid', 'BoundingBox');
keep = [objects.Area] >= config.lesions.minComponentArea & ...
    [objects.Area] <= config.lesions.maxComponentArea;
locations = zeros(0, 2);
if any(keep)
    locations = reshape([objects(keep).Centroid], 2, []).';
end
result = struct('candidate_count', nnz(keep), ...
    'area_pixels', sum([objects(keep).Area]), ...
    'locations', {locations}, ...
    'mask', darkRed, 'method', "dark-red candidate analysis");
end