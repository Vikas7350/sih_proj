function disc = detectOpticDisc(image, config)
%DETECTOPTICDISC Locate a bright optic-disc candidate using morphology.
% This is a prototype candidate detector, not a validated clinical locator.

if nargin < 2 || isempty(config)
    config = defaultRetinalConfig();
end

rgb = im2double(image);
gray = im2gray(rgb);
fundusMask = estimateMask(gray);
bright = adapthisteq(gray);
bright(~fundusMask) = 0;
candidateMask = bright > prctile(bright(fundusMask), 99);
candidateMask = imclose(candidateMask, strel('disk', 5));
candidateMask = imfill(candidateMask, 'holes');

objects = regionprops(candidateMask, 'Area', 'Centroid', 'BoundingBox', 'Eccentricity');
[height, width] = size(gray);
imageArea = height * width;
valid = [];
for index = 1:numel(objects)
    fraction = objects(index).Area / imageArea;
    if fraction >= config.anatomy.minDiscAreaFraction && ...
            fraction <= config.anatomy.maxDiscAreaFraction && ...
            objects(index).Eccentricity < 0.98
        valid(end + 1) = index; %#ok<AGROW>
    end
end

disc = struct('found', false, 'center_xy', [NaN NaN], ...
    'radius', NaN, 'bounding_box', [NaN NaN NaN NaN], ...
    'confidence', 0, 'mask', false(size(gray)));
if isempty(valid)
    return;
end

[~, bestLocal] = max([objects(valid).Area]);
best = objects(valid(bestLocal));
disc.found = true;
disc.center_xy = best.Centroid;
disc.radius = sqrt(best.Area / pi);
disc.bounding_box = best.BoundingBox;
disc.confidence = min(1, best.Area / (0.03 * imageArea));
disc.mask = candidateMask;
end

function mask = estimateMask(gray)
mask = gray > prctile(gray(:), 20);
mask = imclose(mask, strel('disk', 7));
mask = imopen(mask, strel('disk', 5));
mask = bwareafilt(mask, 1);
end