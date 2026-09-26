function fovea = locateFovea(image, opticDisc)
%LOCATEFOVEA Estimate fovea from optic-disc geometry and dark candidates.
% The result is an engineering estimate and requires clinical validation.

rgb = im2double(image);
gray = im2gray(rgb);
[height, width] = size(gray);
fovea = struct('estimated', false, 'center_xy', [NaN NaN], ...
    'confidence', 0, 'method', "not_available", 'mask', false(size(gray)));

if ~opticDisc.found
    return;
end

disc = opticDisc.center_xy;
% Approximate macular direction: temporal and slightly inferior to the disc.
direction = [-1.0, 0.12];
direction = direction / norm(direction);
distance = 2.5 * opticDisc.radius;
estimated = disc + direction * distance;
estimated(1) = min(max(estimated(1), 1), width);
estimated(2) = min(max(estimated(2), 1), height);

radius = max(6, round(0.6 * opticDisc.radius));
[xGrid, yGrid] = meshgrid(1:width, 1:height);
candidateMask = (xGrid - estimated(1)).^2 + ...
    (yGrid - estimated(2)).^2 <= radius^2;
darkness = 1 - mat2gray(gray);
localScore = mean(darkness(candidateMask));

fovea.estimated = true;
fovea.center_xy = estimated;
fovea.confidence = min(1, max(0, localScore));
fovea.method = "optic-disc geometric estimate";
fovea.mask = candidateMask;
end