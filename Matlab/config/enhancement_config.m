function ecfg = enhancement_config()
% ENHANCEMENT_CONFIG Configuration parameters for Stage 2 Borderline Fundus Enhancement
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Centralized configuration for Stage 2 of the clinical AI pipeline:
%   Enhances BORDERLINE retinal fundus images using illumination normalization,
%   conservative CLAHE on luminance, and edge-preserving bilateral denoising.
%
% Safety Constraints:
%   - Enhance ONLY BORDERLINE images.
%   - NEVER enhance GOOD images.
%   - NEVER attempt to repair UNGRADABLE images.
%   - Operates on full-resolution RGB; never resizes for model inference here.
%   - Preserves original image matrix untouched.
%
% Output:
%   ecfg - Struct containing all enhancement parameters and safety constraints.

    ecfg = struct();

    %% 1. Master Enable and Color Space
    ecfg.enabled     = true;
    % Processing in CIE L*a*b* luminance channel strictly preserves chromaticity (a*, b*),
    % preventing artificial discoloration of natural retinal tissue (optic disc and vessels).
    ecfg.color_space = 'Lab';

    %% 2. Illumination Normalization Parameters
    % Estimates the low-frequency background illumination field to correct vignetting,
    % uneven flash gradients, and peripheral shadowing.
    ecfg.illumination.enabled           = true;
    ecfg.illumination.method            = 'gaussian_homomorphic'; % 'gaussian_homomorphic' | 'morphological'
    ecfg.illumination.gaussian_sigma    = 35.0;  % Gaussian filter scale for low-frequency illumination
    ecfg.illumination.correction_weight = 0.55;  % Conservative blend factor (0.55 corrected + 0.45 original)
    ecfg.illumination.epsilon           = 1e-3;  % Numerical stabilizer to avoid division by zero

    %% 3. Contrast-Limited Adaptive Histogram Equalization (CLAHE)
    % Applied strictly to normalized luminance L* in [0, 1] via MATLAB adapthisteq
    ecfg.clahe.enabled      = true;
    ecfg.clahe.clip_limit   = 0.015;      % Conservative clip limit (prevents noise over-amplification)
    ecfg.clahe.num_tiles    = [8, 8];     % 8x8 local contextual regions across fundus
    ecfg.clahe.distribution = 'rayleigh'; % 'rayleigh' produces natural bell-shaped fundus contrast
    ecfg.clahe.alpha        = 0.40;       % Rayleigh distribution parameter

    %% 4. Conservative Edge-Preserving Denoising
    % Bilateral filter (imbilatfilt) smooths homogeneous background sensor noise
    % while strictly preserving sharp boundaries of vessels, microaneurysms, and exudates.
    ecfg.denoise.enabled             = true;
    ecfg.denoise.method              = 'bilateral'; % 'bilateral' via MATLAB imbilatfilt
    ecfg.denoise.degree_of_smoothing = 0.04;        % Range variance (intensity difference threshold)
    ecfg.denoise.spatial_sigma       = 2.0;         % Spatial domain standard deviation (pixels)

    %% 5. Safety & Decision Rules
    ecfg.safety.enhance_only_borderline = true;  % Enforce: skip GOOD, skip UNGRADABLE
    ecfg.safety.preserve_dimensions     = true;  % Dimensions must match input exactly
    ecfg.safety.preserve_uint8          = true;  % Return uint8 RGB image matrix

end
