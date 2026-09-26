function cfg = fundus_config()
% FUNDUS_CONFIG Centralized configuration for Stage 0 Fundus Image Validation
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Defines optical, biological, and morphological thresholds used by
%   quality/checkFundusImage.m to screen images before Quality Assessment.
%   Ensures non-fundus images (graphics, food items, grayscale photos) never
%   reach clinical quality evaluation, enhancement, or deep learning models.
%
% Architecture & Regulatory Note:
%   This module is an input-domain screening gate, not a diabetic retinopathy
%   diagnostic classifier. Parameters are baseline engineering values based on
%   retinal optical physics and fundus camera geometry.

    cfg = struct();

    %% 1. Spectral & Retinal Chromaticity Thresholds
    % Retinal pigment epithelium (melanin) and choroidal hemoglobin reflect strongly
    % in red and moderately in green, while strongly absorbing blue light.
    cfg.color = struct();
    cfg.color.rg_ratio_min         = 1.20;  % Minimum Mean(R)/Mean(G) inside tissue
    cfg.color.rg_ratio_max         = 3.20;  % Maximum Mean(R)/Mean(G) to exclude monochromatic crimson
    cfg.color.gb_ratio_min         = 1.35;  % Minimum Mean(G)/Mean(B) (blue absorption by RPE/xanthophyll)
    cfg.color.rb_ratio_min         = 1.80;  % Minimum Mean(R)/Mean(B) (red dominance)
    cfg.color.min_saturation       = 0.20;  % Minimum HSV saturation to reject neutral grayscale images
    cfg.color.max_deep_red_ratio   = 0.25;  % Maximum fraction of pixels with G < 10 and R > 50
    cfg.color.min_retinal_hue_ratio= 0.50;  % Fraction of pixels in orange-red hue range [0, 0.13] or [0.94, 1.0]

    %% 2. Background Aperture & FOV Geometry Thresholds
    % Standard fundus cameras produce a circular/elliptical field of view on a
    % dark/black camera stop, or a rectangular sensor crop filling the frame.
    cfg.border = struct();
    cfg.border.max_border_mean     = 120.0; % Max mean intensity in 4% border margin (rejects bright/white cutouts)
    cfg.border.dark_border_thresh  = 40.0;  % Threshold below which a border is considered a dark camera aperture
    cfg.border.margin_ratio        = 0.04;  % Border evaluation margin (4% of height and width)
    cfg.border.min_circularity     = 0.65;  % Circularity requirement when aperture border is present
    cfg.border.min_solidity        = 0.85;  % Solidity requirement for candidate FOV mask

    %% 3. Retinal Parenchyma Texture Thresholds
    % Living retinal parenchyma has smooth cellular layers with low local intensity
    % variation, contrasting with coarse textures (wood, grains) or synthetic flat discs.
    cfg.parenchyma = struct();
    cfg.parenchyma.filter_size     = [5, 5]; % Window size for local variance evaluation on Green channel
    cfg.parenchyma.local_std_smooth_limit = 4.0; % Upper std limit defining "smooth" retinal tissue
    cfg.parenchyma.min_smooth_fraction    = 0.40; % Minimum fraction of tissue with local std < 4.0
    cfg.parenchyma.max_median_local_std   = 7.00; % Rejects coarse granular/wood surfaces
    cfg.parenchyma.min_median_local_std   = 0.15; % Rejects featureless synthetic flat graphics

    %% 4. Vascular Network & Morphological Line Thresholds
    % Retinal blood vessels form a continuous dendritic tree with high green-channel
    % optical density (hemoglobin absorption at 540-575 nm).
    cfg.vessels = struct();
    cfg.vessels.line_length        = 11;    % Structuring element length for line top-hat filtering
    cfg.vessels.orientations       = 0:30:150; % Multi-directional filter angles (degrees)
    cfg.vessels.intensity_thresh   = 4.0;   % Minimum top-hat response threshold for vessel segment
    cfg.vessels.min_p90_response   = 3.0;   % 90th percentile of vessel response in tissue
    cfg.vessels.min_branch_length  = 25;    % Minimum connected component pixel count for vessel branch
    cfg.vessels.min_long_vessel_pixels = 80;% Total pixels belonging to connected long vessel branches

    %% 5. Candidate FOV Extraction
    cfg.fov = struct();
    cfg.fov.intensity_thresh       = 15.0;  % Foreground threshold on smoothed max channel
    cfg.fov.smoothing_sigma        = 2.0;   % Gaussian smoothing sigma before thresholding
    cfg.fov.erosion_disk_radius    = 15;    % Margin erosion radius to avoid aperture boundary artifacts
    cfg.fov.full_frame_ratio       = 0.90;  % Area ratio above which image is treated as rectangular crop

    %% 6. Scoring Weights & Decision Thresholds
    cfg.weights = struct();
    cfg.weights.color              = 0.30;
    cfg.weights.border             = 0.25;
    cfg.weights.parenchyma         = 0.25;
    cfg.weights.vessels            = 0.20;

    cfg.decision = struct();
    cfg.decision.thresh_fundus     = 0.75;  % Score required for FUNDUS status (all hard checks must pass)
    cfg.decision.thresh_non_fundus = 0.35;  % Score below which status is definitively NON_FUNDUS

end
