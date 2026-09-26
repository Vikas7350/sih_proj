function metrics = evaluateDR(groundTruth, predictions, cfg)
% EVALUATEDR Evaluate diabetic retinopathy screening and classification metrics
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   metrics = evaluateDR(groundTruth, predictions, cfg)
%
% Inputs:
%   groundTruth - Array of true ICDR labels (values 0 through 4)
%   predictions - Array of predicted ICDR labels (values 0 through 4)
%   cfg         - (Optional) Configuration struct from model_config()
%
% Outputs:
%   metrics - Struct containing clinical performance indicators:
%             .accuracy              - Multi-class classification accuracy
%             .referable_sensitivity - Sensitivity for referable DR (grade >= 2)
%             .referable_specificity - Specificity for referable DR (grade >= 2)
%             .confusion_matrix      - 5x5 confusion matrix
%             .sample_count          - Number of evaluated samples
%
% Notes:
%   Designed for standard evaluation against benchmarking datasets (e.g.,
%   EyePACS, Messidor-2, APTOS 2019) per SIH 26038 guidelines.
%   Does not include invented or uncalibrated clinical claims.

    if nargin < 3 || isempty(cfg)
        cfg = model_config();
    end

    metrics = struct();
    metrics.accuracy = NaN;
    metrics.referable_sensitivity = NaN;
    metrics.referable_specificity = NaN;
    metrics.confusion_matrix = [];
    metrics.sample_count = 0;

    if isempty(groundTruth) || isempty(predictions)
        return;
    end

    groundTruth = groundTruth(:);
    predictions = predictions(:);

    if numel(groundTruth) ~= numel(predictions)
        error('evaluateDR:DimensionMismatch', 'groundTruth and predictions must have identical sample lengths.');
    end

    n = numel(groundTruth);
    metrics.sample_count = n;

    % Multi-class accuracy
    metrics.accuracy = sum(groundTruth == predictions) / n;

    % Referable DR binary classification metrics (ICDR >= 2)
    refThreshold = cfg.classes.referral_threshold;
    trueRef = (groundTruth >= refThreshold);
    predRef = (predictions >= refThreshold);

    tp = sum(trueRef & predRef);
    fp = sum(~trueRef & predRef);
    tn = sum(~trueRef & ~predRef);
    fn = sum(trueRef & ~predRef);

    if (tp + fn) > 0
        metrics.referable_sensitivity = tp / (tp + fn);
    end

    if (tn + fp) > 0
        metrics.referable_specificity = tn / (tn + fp);
    end

    % 5-class Confusion matrix
    classes = cfg.classes.grades;
    numClasses = numel(classes);
    cm = zeros(numClasses, numClasses);
    for i = 1:numClasses
        for j = 1:numClasses
            cm(i, j) = sum((groundTruth == classes(i)) & (predictions == classes(j)));
        end
    end
    metrics.confusion_matrix = cm;

end
