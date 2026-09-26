function reportPath = createRetinalReport(result, outputDir, reportName)
%CREATERETINALREPORT Create a combined visual report for one image.

if nargin < 2 || isempty(outputDir)
    outputDir = fullfile('results', 'matlab');
end
if nargin < 3 || isempty(reportName)
    reportName = 'retinal_report.png';
end
if ~exist(outputDir, 'dir')
    mkdir(outputDir);
end

figure('Visible', 'off', 'Position', [100 100 1400 800]);
tiledlayout(2, 3, 'Padding', 'compact');

nexttile;
if isfield(result, 'enhancement') && isfield(result.enhancement, 'original_image')
    imshow(imread(result.enhancement.original_image));
else
    axis off;
end
title('Original');

nexttile;
if isfield(result, 'enhancement') && isfield(result.enhancement, 'enhanced_image')
    imshow(imread(result.enhancement.enhanced_image));
else
    axis off;
end
title('Enhanced');

nexttile;
if isfield(result, 'retinal_analysis') && isfield(result.retinal_analysis.vessels, 'mask_image')
    imshow(imread(result.retinal_analysis.vessels.mask_image));
else
    axis off;
end
title('Vessel candidates');

nexttile;
if isfield(result, 'retinal_analysis') && isfield(result.retinal_analysis.microaneurysm, 'mask_image')
    imshow(imread(result.retinal_analysis.microaneurysm.mask_image));
else
    axis off;
end
title('Microaneurysm candidates');

nexttile;
if isfield(result, 'retinal_analysis') && isfield(result.retinal_analysis.exudates, 'mask_image')
    imshow(imread(result.retinal_analysis.exudates.mask_image));
else
    axis off;
end
title('Exudate candidates');

nexttile;
if isfield(result, 'retinal_analysis') && isfield(result.retinal_analysis.hemorrhage, 'mask_image')
    imshow(imread(result.retinal_analysis.hemorrhage.mask_image));
else
    axis off;
end
title('Hemorrhage candidates');

reportPath = fullfile(outputDir, reportName);
exportgraphics(gcf, reportPath);
close(gcf);
end
