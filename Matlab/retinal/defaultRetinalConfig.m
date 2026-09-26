function config = defaultRetinalConfig()
%DEFAULTRETINALCONFIG Engineering parameters for retinal analysis prototypes.

try
    config.quality = quality_config();
catch
    config.quality.minWidth = 640;
    config.quality.minHeight = 480;
    config.quality.minBrightness = 35;
    config.quality.maxBrightness = 220;
    config.quality.minContrast = 25;
    config.quality.minSharpness = 3;
    config.quality.minFundusVisibility = 0.50;
    config.quality.enhanceScoreThreshold = 70;
    config.quality.recaptureSharpness = 1.5;
    config.quality.recaptureVisibility = 0.25;
end

config.enhancement.claheClipLimit = 0.01;
config.enhancement.backgroundSigma = 25;
config.enhancement.medianWindow = [3 3];
config.enhancement.unsharpAmount = 0.35;
config.enhancement.unsharpRadius = 1.0;

config.anatomy.minDiscAreaFraction = 0.002;
config.anatomy.maxDiscAreaFraction = 0.20;
config.anatomy.vesselSensitivity = 0.45;

config.lesions.minComponentArea = 3;
config.lesions.maxComponentArea = 1500;
config.lesions.minExudateArea = 8;

config.output.saveIntermediate = true;
config.output.imageFormat = 'png';
end