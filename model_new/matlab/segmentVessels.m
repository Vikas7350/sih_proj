function vessels = segmentVessels(image, config)
%SEGMENTVESSELS Segment vessel candidates from the green channel.
% Outputs are research indicators and are not validated vessel segmentation.

if nargin < 2 || isempty(config)
    config = defaultRetinalConfig();
end

rgb = im2double(image);
green = rgb(:, :, 2);
green = adapthisteq(green, 'ClipLimit', 0.01);
background = imopen(green, strel('disk', 9));
detail = background - green;
detail = mat2gray(detail);
mask = detail > config.anatomy.vesselSensitivity;
mask = bwareaopen(mask, 8);
mask = imclose(mask, strel('disk', 1));
mask = imopen(mask, strel('disk', 1));

fundusMask = green > prctile(green(:), 20);
mask = mask & fundusMask;
pixels = nnz(fundusMask);
if pixels == 0
    density = 0;
else
    density = nnz(mask) / pixels;
end

skel = bwskel(mask);
vessels = struct();
vessels.mask = mask;
vessels.skeleton = skel;
vessels.density = density;
vessels.area_percentage = 100 * density;
vessels.skeleton_length_pixels = nnz(skel);
vessels.features = struct('branching_proxy', ...
    nnz(bwmorph(skel, 'branchpoints')), 'tortuosity_proxy', NaN);
end