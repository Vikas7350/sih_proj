function result = runRetinalAnalysis(imagePath, varargin)
%RUNRETINALANALYSIS Run quality, enhancement, anatomy, and lesion prototypes.
% The result is supporting analysis for the Python DR classifier.

parser = inputParser;
addParameter(parser, 'OutputDir', fullfile('results', 'matlab'), @ischar);
addParameter(parser, 'Config', defaultRetinalConfig(), @isstruct);
parse(parser, varargin{:});
outputDir = parser.Results.OutputDir;
config = parser.Results.Config;

if ~isfile(imagePath)
    error('runRetinalAnalysis:MissingImage', 'Image not found: %s', imagePath);
end
if ~exist(outputDir, 'dir')
    mkdir(outputDir);
end

startTime = tic;
original = imread(imagePath);
quality = assessQuality(original, config);
enhancement = enhanceFundus(original, quality, config);

result = struct('status', "SUCCESS", 'image', char(imagePath), ...
    'quality', removeLargeFields(quality, {'fundus_mask'}), ...
    'enhancement', removeLargeFields(enhancement, {'original', 'image'}));

if strcmp(quality.status, 'INSUFFICIENT')
    result.status = "INSUFFICIENT";
    result.retinal_analysis = struct();
    result.processing_time_seconds = toc(startTime);
    saveSummary(result, outputDir, imagePath);
    return;
end

analysisImage = enhancement.image;
opticDisc = detectOpticDisc(analysisImage, config);
fovea = locateFovea(analysisImage, opticDisc);
vessels = segmentVessels(analysisImage, config);
microaneurysms = detectMicroaneurysms(analysisImage, config);
exudates = detectExudates(analysisImage, opticDisc, config);
hemorrhages = detectHemorrhages(analysisImage, config);
neovascularization = analyzeNeovascularization(vessels);

result.retinal_analysis = struct(...
    'optic_disc', removeLargeFields(opticDisc, {'mask'}), ...
    'fovea', removeLargeFields(fovea, {'mask'}), ...
    'vessels', removeLargeFields(vessels, {'mask', 'skeleton'}), ...
    'microaneurysm', removeLargeFields(microaneurysms, {'mask'}), ...
    'exudates', removeLargeFields(exudates, {'mask'}), ...
    'hemorrhage', removeLargeFields(hemorrhages, {'mask'}), ...
    'neovascularization', neovascularization);
result.processing_time_seconds = toc(startTime);

if config.output.saveIntermediate
    saveVisualOutputs(original, analysisImage, quality, opticDisc, fovea, ...
        vessels, microaneurysms, exudates, hemorrhages, outputDir);
    result.enhancement.enhanced_image = fullfile(outputDir, 'enhanced.png');
    result.enhancement.original_image = fullfile(outputDir, 'original.png');
    result.retinal_analysis.vessels.mask_image = fullfile(outputDir, 'vessel_mask.png');
    result.retinal_analysis.microaneurysm.mask_image = fullfile(outputDir, 'microaneurysm_candidates.png');
    result.retinal_analysis.exudates.mask_image = fullfile(outputDir, 'exudate_candidates.png');
    result.retinal_analysis.hemorrhage.mask_image = fullfile(outputDir, 'hemorrhage_candidates.png');
end
saveSummary(result, outputDir, imagePath);
end

function output = removeLargeFields(input, fields)
output = input;
for index = 1:numel(fields)
    if isfield(output, fields{index})
        output = rmfield(output, fields{index});
    end
end
end

function saveSummary(result, outputDir, imagePath)
[~, stem] = fileparts(imagePath);
summaryPath = fullfile(outputDir, [stem '_retinal_analysis.json']);
fid = fopen(summaryPath, 'w');
cleanup = onCleanup(@() fclose(fid));
fprintf(fid, '%s', jsonencode(result, 'PrettyPrint', true));
end

function saveVisualOutputs(original, enhanced, quality, opticDisc, fovea, ...
    vessels, microaneurysms, exudates, hemorrhages, outputDir)
imwrite(original, fullfile(outputDir, 'original.png'));
imwrite(enhanced, fullfile(outputDir, 'enhanced.png'));
imwrite(uint8(vessels.mask) * 255, fullfile(outputDir, 'vessel_mask.png'));
imwrite(uint8(microaneurysms.mask) * 255, fullfile(outputDir, 'microaneurysm_candidates.png'));
imwrite(uint8(exudates.mask) * 255, fullfile(outputDir, 'exudate_candidates.png'));
imwrite(uint8(hemorrhages.mask) * 255, fullfile(outputDir, 'hemorrhage_candidates.png'));

fig1 = figure('Visible', 'off');
imshow(enhanced); hold on;
if opticDisc.found
    viscircles(opticDisc.center_xy, opticDisc.radius, 'Color', 'y');
end
if fovea.estimated
    plot(fovea.center_xy(1), fovea.center_xy(2), 'c+', 'LineWidth', 2, 'MarkerSize', 12);
end
qScore = 0;
if isfield(quality, 'overallScore'), qScore = quality.overallScore;
elseif isfield(quality, 'score'), qScore = quality.score;
elseif isfield(quality, 'quality_score'), qScore = quality.quality_score;
end
title(sprintf('Quality: %s | Score: %.2f', quality.status, qScore));
saveas(fig1, fullfile(outputDir, 'anatomy_overlay.png'));
close(fig1);
if ishandle(fig1), delete(fig1); end

fig2 = figure('Visible', 'off');
imshow(enhanced); hold on;
if any(vessels.mask(:)), visboundaries(vessels.mask, 'Color', 'g'); end
if any(microaneurysms.mask(:)), visboundaries(microaneurysms.mask, 'Color', 'r'); end
if any(exudates.mask(:)), visboundaries(exudates.mask, 'Color', 'y'); end
if any(hemorrhages.mask(:)), visboundaries(hemorrhages.mask, 'Color', 'm'); end
title('Prototype vessel and lesion candidates');
saveas(fig2, fullfile(outputDir, 'retinal_analysis_overlay.png'));
close(fig2);
if ishandle(fig2), delete(fig2); end
close all force;
end