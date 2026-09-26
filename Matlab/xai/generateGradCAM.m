function [heatmap, overlayPath, overlayImg] = generateGradCAM(net, imgInput, classIdx, cfg)
% GENERATEGRADCAM Generate Explainable AI (Grad-CAM) saliency map and overlay
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   [heatmap, overlayPath] = generateGradCAM(net, imgInput, classIdx)
%   [heatmap, overlayPath, overlayImg] = generateGradCAM(net, imgInput, classIdx, cfg)
%
% Inputs:
%   net      - Deep learning network object or placeholder struct from loadModel()
%   imgInput - File path string OR RGB/grayscale image matrix
%   classIdx - (Optional) Target class index (1 to 5; 1-indexed in MATLAB). Defaults to 1
%   cfg      - (Optional) Configuration struct from model_config()
%
% Outputs:
%   heatmap     - 2D normalized Grad-CAM activation array [0, 1]
%   overlayPath - File path string where generated overlay PNG is saved
%   overlayImg  - (Optional) RGB overlay matrix of fundus scan and saliency map
%
% Blueprint Reference:
%   Matches Blueprint Section 10 contract field 'xai.gradcam_path' and
%   Integration Guide Section 3.2 starter code.

    if nargin < 4 || isempty(cfg)
        cfg = model_config();
    end

    if nargin < 3 || isempty(classIdx)
        classIdx = 1;
    end

    % 1. Image Ingestion
    if ischar(imgInput) || isstring(imgInput)
        if ~isfile(imgInput)
            error('generateGradCAM:FileNotFound', 'Image file not found: %s', imgInput);
        end
        img = imread(char(imgInput));
    else
        img = imgInput;
    end

    if isempty(img)
        error('generateGradCAM:EmptyInput', 'Input image cannot be empty.');
    end

    imgHeight = size(img, 1);
    imgWidth = size(img, 2);

    % 2. Saliency Map Generation via Real Grad-CAM (No Synthetic Fallbacks)
    % Preprocess using deterministic PIL-equivalent bilinear resize matching predictDR.m
    resizedImg = pil_bilinear_resize(img, cfg.image.input_size(1:2));

    featureLayer = cfg.xai.feature_layer;
    if isfield(cfg.xai, 'reduction_layer') && ~isempty(cfg.xai.reduction_layer)
        reductionLayer = cfg.xai.reduction_layer;
    else
        reductionLayer = 'x_classifier_classif';
    end

    % Calculate genuine Grad-CAM on the imported deep learning network
    scoreMap = gradCAM(net, resizedImg, classIdx, ...
        'FeatureLayer', featureLayer, ...
        'ReductionLayer', reductionLayer);

    % Bilinearly interpolate raw Grad-CAM back to native input image dimensions
    heatmap = imresize(scoreMap, [imgHeight, imgWidth]);

    % Min-max normalize heatmap to [0, 1] range
    minVal = min(heatmap(:));
    maxVal = max(heatmap(:));
    if maxVal > minVal
        heatmap = (heatmap - minVal) / (maxVal - minVal);
    else
        heatmap = zeros(size(heatmap), 'like', heatmap);
    end

    % 3. Create Blended Visualization Overlay
    if ndims(img) == 3 && size(img, 3) == 3
        grayImg = rgb2gray(img);
    else
        grayImg = img;
    end

    % Color map overlay
    cmap = jet(256);
    indexedMap = uint8(heatmap * 255);
    heatmapRGB = ind2rgb(indexedMap, cmap);

    doubleImg = im2double(grayImg);
    baseRGB = repmat(doubleImg, [1, 1, 3]);

    alpha = cfg.xai.overlay_alpha;
    overlayImg = (1 - alpha) * baseRGB + alpha * heatmapRGB;

    % 4. Save Overlay Image to Disk (matching Blueprint Section 10)
    outputDir = cfg.paths.results;
    if ~isfolder(outputDir)
        outputDir = tempdir;
    end

    uniqueId = char(java.util.UUID.randomUUID().toString());
    overlayFileName = sprintf('gradcam_%s.png', uniqueId(1:8));
    overlayPath = fullfile(outputDir, overlayFileName);

    imwrite(im2uint8(overlayImg), overlayPath);

end
