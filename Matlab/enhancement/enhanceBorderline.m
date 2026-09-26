function [enhancement, enhancedImg] = enhanceBorderline(inputImg, cfg)
% ENHANCEBORDERLINE Enhance BORDERLINE retinal fundus images per clinical AI protocol
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   enhancement = enhanceBorderline(inputImg)
%   enhancement = enhanceBorderline(inputImg, cfg)
%   [enhancement, enhancedImg] = enhanceBorderline(inputImg, cfg)
%
% Pipeline Logic:
%   GOOD image        -> NO enhancement -> proceed directly to model
%   BORDERLINE image  -> ENHANCEMENT -> re-run assessQuality()
%                        if acceptable -> proceed to model
%                        if still unacceptable -> RECAPTURE
%   UNGRADABLE image  -> NO enhancement -> RECAPTURE
%
% Operations (for BORDERLINE only):
%   1. Luminance isolation in CIE L*a*b* space (preserves natural retinal colors).
%   2. Low-frequency illumination normalization (homomorphic background estimation).
%   3. Contrast-Limited Adaptive Histogram Equalization (CLAHE via adapthisteq).
%   4. Conservative edge-preserving bilateral denoising (via imbilatfilt).
%
% Safety Rules:
%   - Enhances ONLY BORDERLINE images.
%   - NEVER enhances GOOD images.
%   - NEVER attempts to repair UNGRADABLE images.
%   - Does NOT resize image to 224x224 (model resizing remains in predictDR.m).
%   - Preserves original image dimensions and RGB format.
%
% Outputs:
%   enhancement.applied       - Logical true if enhancement was applied, false otherwise
%   enhancement.method        - String describing applied algorithms
%   enhancement.originalImage - Unmodified uint8 RGB image matrix
%   enhancement.enhancedImage - Enhanced uint8 RGB image matrix (or original if bypassed)
%   enhancement.beforeQuality - assessQuality() struct before enhancement
%   enhancement.afterQuality  - assessQuality() struct after enhancement
%   enhancement.improved      - Logical true if overall score increased or status improved
%   enhancement.reasons       - Cell array of strings explaining decisions and operations
%   enhancedImg               - Convenience output: enhanced image matrix

    %% 1. Configuration Resolution
    if nargin < 2 || isempty(cfg)
        cfg = model_config();
        ecfg = cfg.enhancement;
    elseif isfield(cfg, 'enhancement')
        ecfg = cfg.enhancement;
    else
        ecfg = cfg;
    end

    %% 2. Ingest Original Image
    if ischar(inputImg) || isstring(inputImg)
        if ~isfile(inputImg)
            error('enhanceBorderline:FileNotFound', 'Image file not found: %s', inputImg);
        end
        origImg = imread(char(inputImg));
    else
        origImg = inputImg;
    end

    if isempty(origImg)
        error('enhanceBorderline:EmptyInput', 'Input image cannot be empty.');
    end

    % Standardize to 3-channel RGB uint8
    if ndims(origImg) == 2
        origImg = repmat(origImg, [1, 1, 3]);
    elseif size(origImg, 3) == 1
        origImg = repmat(origImg, [1, 1, 3]);
    elseif size(origImg, 3) > 3
        origImg = origImg(:, :, 1:3);
    end

    if ~isa(origImg, 'uint8')
        origImg = uint8(round(origImg));
    end

    %% 3. Stage 1 Quality Assessment (Pre-Enhancement Baseline)
    beforeQuality = assessQuality(origImg, cfg);
    origStatus = beforeQuality.status;

    %% 4. Triage & Decision Gate
    reasons = {};
    applied = false;
    improved = false;
    enhancedImg = origImg;
    afterQuality = beforeQuality;
    methodStr = 'None (Bypassed)';

    switch origStatus
        case 'GOOD'
            % Safety Rule: NEVER enhance GOOD images
            methodStr = 'None (Bypassed: Image is already GOOD)';
            reasons{end + 1} = 'Image quality is GOOD. Enhancement bypassed per clinical safety protocol.';
            
        case 'UNGRADABLE'
            % Safety Rule: NEVER attempt to repair UNGRADABLE images
            methodStr = 'None (Bypassed: Image is UNGRADABLE)';
            reasons{end + 1} = 'Image is UNGRADABLE. Post-processing repair prohibited; patient RECAPTURE required.';
            
        case 'BORDERLINE'
            % Approved for conservative enhancement
            applied = true;
            methodStr = 'CIE-Lab Luminance: Illumination Normalization + CLAHE + Bilateral Denoising';
            reasons{end + 1} = sprintf('Image is BORDERLINE (Score: %.3f). Applying conservative enhancement.', beforeQuality.overallScore);

            %% 5. Execute Multi-Stage Enhancement
            % A. Transform to CIE L*a*b* space to separate luminance from chromaticity
            labImg = rgb2lab(origImg);
            L = labImg(:, :, 1) / 100.0; % Normalize L* from [0, 100] to [0.0, 1.0]
            a = labImg(:, :, 2);
            b = labImg(:, :, 3);

            % B. Low-Frequency Illumination Normalization
            if isfield(ecfg, 'illumination') && ecfg.illumination.enabled
                sigma = ecfg.illumination.gaussian_sigma;
                bg = imgaussfilt(L, sigma);
                meanBg = mean(bg(:));
                
                % Homomorphic ratio correction with numerical stabilizer
                L_norm = L .* (meanBg ./ (bg + ecfg.illumination.epsilon));
                L_norm = max(0.0, min(1.0, L_norm));
                
                % Conservative blend with original luminance
                wIllum = ecfg.illumination.correction_weight;
                L = (1.0 - wIllum) * L + wIllum * L_norm;
                reasons{end + 1} = sprintf('Illumination field normalized (Gaussian sigma=%.1f, blend=%.2f)', sigma, wIllum);
            end

            % C. Contrast-Limited Adaptive Histogram Equalization (CLAHE)
            if isfield(ecfg, 'clahe') && ecfg.clahe.enabled
                clipLim = ecfg.clahe.clip_limit;
                numTiles = ecfg.clahe.num_tiles;
                distr = ecfg.clahe.distribution;
                alphaVal = ecfg.clahe.alpha;
                
                L = adapthisteq(L, ...
                    'ClipLimit', clipLim, ...
                    'NumTiles', numTiles, ...
                    'Distribution', distr, ...
                    'Alpha', alphaVal);
                reasons{end + 1} = sprintf('CLAHE applied (ClipLimit=%.3f, Tiles=[%dx%d], %s distribution)', ...
                    clipLim, numTiles(1), numTiles(2), distr);
            end

            % D. Conservative Edge-Preserving Denoising
            if isfield(ecfg, 'denoise') && ecfg.denoise.enabled
                dos = ecfg.denoise.degree_of_smoothing;
                spatSig = ecfg.denoise.spatial_sigma;
                
                % Bilateral filter smooths background while preserving sharp micro-vessel edges
                L = imbilatfilt(L, dos, spatSig);
                reasons{end + 1} = sprintf('Bilateral edge-preserving filter applied (smoothing=%.3f, spatial=%.1f)', dos, spatSig);
            end

            % E. Reconstruct RGB Image Matrix
            labEnhanced = cat(3, L * 100.0, a, b);
            rgbEnhanced = lab2rgb(labEnhanced);
            enhancedImg = uint8(round(max(0.0, min(1.0, rgbEnhanced)) * 255.0));

            % F. Re-run Quality Assessment on Enhanced Image
            afterQuality = assessQuality(enhancedImg, cfg);

            % G. Evaluate Quality Trajectory
            scoreGain = afterQuality.overallScore - beforeQuality.overallScore;
            isStatusPromoted = strcmp(beforeQuality.status, 'BORDERLINE') && strcmp(afterQuality.status, 'GOOD');
            improved = (scoreGain > 0.0) || isStatusPromoted;

            if isStatusPromoted
                reasons{end + 1} = sprintf('SUCCESS: Quality promoted from BORDERLINE to GOOD (Score: %.3f -> %.3f, +%.3f)', ...
                    beforeQuality.overallScore, afterQuality.overallScore, scoreGain);
            elseif improved
                reasons{end + 1} = sprintf('PARTIAL: Quality score improved (+%.3f), status remains BORDERLINE (Score: %.3f -> %.3f)', ...
                    scoreGain, beforeQuality.overallScore, afterQuality.overallScore);
            else
                reasons{end + 1} = sprintf('UNRESOLVED: Quality score did not improve (Score: %.3f -> %.3f). Recommend RECAPTURE.', ...
                    beforeQuality.overallScore, afterQuality.overallScore);
            end
    end

    %% 6. Assemble Output Struct
    enhancement = struct();
    enhancement.applied       = applied;
    enhancement.method        = methodStr;
    enhancement.originalImage = origImg;
    enhancement.enhancedImage = enhancedImg;
    enhancement.beforeQuality = beforeQuality;
    enhancement.afterQuality  = afterQuality;
    enhancement.improved      = improved;
    enhancement.reasons       = reasons;

end
