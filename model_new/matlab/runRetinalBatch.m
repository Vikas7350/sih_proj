function summary = runRetinalBatch(inputDir, outputDir, varargin)
%RUNRETINALBATCH Run retinal analysis for all JPG/PNG images in a folder.

if nargin < 2 || isempty(outputDir)
    outputDir = fullfile('results', 'matlab_batch');
end
if ~exist(outputDir, 'dir')
    mkdir(outputDir);
end

config = defaultRetinalConfig();
parser = inputParser;
addParameter(parser, 'Config', config, @isstruct);
parse(parser, varargin{:});
config = parser.Results.Config;

files = [dir(fullfile(inputDir, '*.jpg')); dir(fullfile(inputDir, '*.jpeg')); ...
    dir(fullfile(inputDir, '*.png')); dir(fullfile(inputDir, '*.JPG')); ...
    dir(fullfile(inputDir, '*.PNG'))];
summary = struct('image', {}, 'status', {}, 'quality_score', {}, ...
    'enhancement_applied', {}, 'processing_time_seconds', {}, 'error', {});

for index = 1:numel(files)
    sourcePath = fullfile(files(index).folder, files(index).name);
    try
        result = runRetinalAnalysis(sourcePath, 'OutputDir', outputDir, 'Config', config);
        summary(index).image = files(index).name;
        summary(index).status = result.status;
        summary(index).quality_score = result.quality.quality_score;
        summary(index).enhancement_applied = result.enhancement.applied;
        summary(index).processing_time_seconds = result.processing_time_seconds;
        summary(index).error = '';
    catch exception
        summary(index).image = files(index).name;
        summary(index).status = 'ERROR';
        summary(index).quality_score = NaN;
        summary(index).enhancement_applied = false;
        summary(index).processing_time_seconds = NaN;
        summary(index).error = exception.message;
    end
end

if isempty(summary)
    warning('runRetinalBatch:NoImages', 'No JPG, JPEG, or PNG files found in %s.', inputDir);
    return;
end

summaryTable = struct2table(summary);
writetable(summaryTable, fullfile(outputDir, 'retinal_batch_summary.csv'));
end
