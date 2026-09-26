function qcfg = quality_config()
% QUALITY_CONFIG Configuration thresholds and parameters for Image Quality Assessment
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Centralized configuration for Stage 1 of the clinical AI pipeline:
%   retinal fundus image quality assessment (Focus, Illumination, Contrast, FOV).
%
% Disclaimer:
%   Thresholds are initial engineering baseline parameters established for the
%   SIH 2026 prototype. They are NOT yet clinically validated against large-scale
%   multi-ethnic screening cohorts (e.g., EyePACS, Messidor-2).
%
% Output:
%   qcfg - Struct containing all quality criteria, weights, and decision bounds.

    qcfg = struct();

    %% 1. Field of View (FOV) Estimation Parameters
    % Retinal tissue is segmented against pitch-black background borders
    qcfg.fov.bg_intensity_threshold = 20;     % Max RGB channel intensity to separate background
    qcfg.fov.min_area_ratio_good    = 0.50;   % >= 50% image area is retinal tissue -> GOOD
    qcfg.fov.min_area_ratio_border  = 0.30;   % 30% - 50% -> BORDERLINE, < 30% -> INSUFFICIENT
    qcfg.fov.clean_disk_radius      = 5;      % Disk radius for morphological closing/cleaning
    qcfg.fov.boundary_erosion_disk  = 8;      % Erosion radius to remove high-contrast circular aperture edges

    %% 2. Focus / Blur Parameters (Laplacian & Gradient Sharpness)
    % Evaluated inside eroded FOV mask to avoid aperture boundary edge artifacts
    qcfg.focus.method               = 'laplacian_variance'; % 'laplacian_variance' | 'gradient_mean'
    qcfg.focus.laplacian_alpha      = 0.2;    % Shape parameter for fspecial('laplacian', alpha)
    qcfg.focus.raw_thresh_good      = 15.0;   % LapVar >= 15.0 -> SHARP / GOOD
    qcfg.focus.raw_thresh_border    = 3.0;    % LapVar 3.0 - 15.0 -> BORDERLINE, < 3.0 -> BLURRY
    qcfg.focus.norm_saturation_ref  = 50.0;   % Reference value mapping raw metric to ~1.0

    %% 3. Illumination Parameters (Exposure, Uniformity, Saturation)
    % Evaluated within FOV mask
    qcfg.illumination.min_mean_good   = 55.0;   % Lower bound for adequate mean brightness
    qcfg.illumination.max_mean_good   = 165.0;  % Upper bound for adequate mean brightness
    qcfg.illumination.min_mean_border = 40.0;   % Mean < 40 -> Severely dark / underexposed
    qcfg.illumination.max_mean_border = 185.0;  % Mean > 185 -> Severely washed out / overexposed
    qcfg.illumination.optimal_mean    = 115.0;  % Target mid-range exposure for fundus imagery
    
    qcfg.illumination.sat_intensity_thresh = 250; % Pixel level considered saturated
    qcfg.illumination.max_sat_ratio_good   = 0.05;% Saturation <= 5% -> GOOD
    qcfg.illumination.max_sat_ratio_border = 0.20;% Saturation > 20% -> High overexposure
    
    qcfg.illumination.dark_intensity_thresh = 15;  % Pixel level considered underexposed shadow
    qcfg.illumination.max_dark_ratio_good   = 0.05;% Dark pixels <= 5% in FOV
    qcfg.illumination.max_dark_ratio_border = 0.18;% Dark pixels > 18% in FOV -> High shadow/underexposure
    
    qcfg.illumination.grid_blocks          = [3, 3]; % Grid for spatial illumination uniformity
    qcfg.illumination.max_uneven_cv_good   = 0.35;   % Coefficient of variation across spatial blocks

    %% 4. Contrast Parameters (Dynamic Range & Structural Visibility)
    % Evaluated within FOV mask using robust percentile separation
    qcfg.contrast.p_high              = 95;     % Upper percentile
    qcfg.contrast.p_low               = 5;      % Lower percentile
    qcfg.contrast.raw_p95_5_good      = 60.0;   % Inter-percentile range (P95 - P5) >= 60.0 -> GOOD
    qcfg.contrast.raw_p95_5_border    = 30.0;   % Range 30.0 - 60.0 -> BORDERLINE, < 30.0 -> LOW_CONTRAST
    qcfg.contrast.raw_std_good        = 20.0;   % Standard deviation >= 20.0 -> GOOD
    qcfg.contrast.raw_std_border      = 10.0;   % Standard deviation < 10.0 -> LOW_CONTRAST
    qcfg.contrast.norm_saturation_ref = 120.0;  % Reference range mapping P95-5 to score ~1.0

    %% 5. Overall Quality Scoring Weights & Decision Thresholds
    qcfg.weights.focus        = 0.30;
    qcfg.weights.illumination = 0.25;
    qcfg.weights.contrast     = 0.25;
    qcfg.weights.fov          = 0.20;

    % Overall composite score classification thresholds [0.0, 1.0]
    qcfg.decision.thresh_good       = 0.65; % Overall score >= 0.65 -> GOOD (Gradable)
    qcfg.decision.thresh_borderline = 0.40; % 0.40 <= Score < 0.65 -> BORDERLINE (Enhanceable)
                                            % Score < 0.40 -> UNGRADABLE (Rejected)

    % Hard-fail criteria (triggers UNGRADABLE regardless of composite score)
    qcfg.hard_fail.min_fov_ratio       = 0.25;  % Severely restricted aperture / missing retina
    qcfg.hard_fail.min_focus_lapvar    = 1.0;   % Severe optical defocus
    qcfg.hard_fail.min_contrast_p95_5  = 15.0;  % Severe loss of dynamic range
    qcfg.hard_fail.max_saturation      = 0.25;  % > 25% of retinal tissue is blown out / clipped white
    qcfg.hard_fail.min_mean_brightness = 30.0;  % Pitch black image

end
