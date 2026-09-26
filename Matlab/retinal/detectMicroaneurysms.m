function result = detectMicroaneurysms(image, config)
%DETECTMICROANEURYSMS Detect small dark candidate regions.
% These are image-analysis candidates, not clinical detections.

if nargin < 2 || isempty(config)
    config = defaultRetinalConfig();
end

rgb = im2double(image);
green = adapthisteq(rgb(:, :, 2), 'ClipLimit', 0.02);
background = imopen(green, strel('disk', 9));
darkDetail = mat2gray(background - green);
mask = darkDetail > 0.62;
mask = bwareaopen(mask, config.lesions.minComponentArea);
mask = imopen(mask, strel('disk', 1));

objects = regionprops(mask, 'Area', 'Centroid', 'BoundingBox');
keep = false(size(objects));
for index = 1:numel(objects)
    keep(index) = objects(index).Area >= config.lesions.minComponentArea && ...
        objects(index).Area <= config.lesions.maxComponentArea;
end

locations = zeros(0, 2);
if any(keep)
    locations = reshape([objects(keep).Centroid], 2, []).';
end

result = struct('candidate_count', nnz(keep), ...
    'locations', {locations}, ...
    'mask', mask, 'method', "dark green-channel candidate analysis");
end