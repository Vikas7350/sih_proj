function [grade, probs, predStruct] = predictDR(net, imgInput, cfgOrInputSize)
% PREDICTDR Predict Diabetic Retinopathy grade and class probabilities
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Syntax:
%   [grade, probs] = predictDR(net, imgInput)
%   [grade, probs, predStruct] = predictDR(net, imgInput, cfg)
%
% Inputs:
%   net            - Deep learning network object (dlnetwork/DAGNetwork) or structure
%   imgInput       - File path string OR RGB image matrix
%   cfgOrInputSize - (Optional) model_config() struct OR 1x2/1x3 input size vector
%
% Outputs:
%   grade      - Integer DR severity grade (0 to 4 per ICDR standard):
%                0: No DR, 1: Mild DR, 2: Moderate DR, 3: Severe DR, 4: Proliferative DR
%   probs      - 1x5 vector of probabilities across grades [0, 1, 2, 3, 4]
%   predStruct - Struct conforming to Blueprint Section 10 contract:
%                .grade       - Integer 0–4
%                .label       - String label
%                .confidence  - Struct with .raw and .calibrated
%                .referable   - Logical flag (grade >= 2)
%
% Parity Reference:
%   Strictly adheres to Python PyTorch torchvision EfficientNet-B0 preprocessing:
%   Input: 224x224, RGB, Bilinear, ToTensor [0,1], ImageNet Normalization (mean/std).

    % 1. Parse Configuration
    if nargin < 3 || isempty(cfgOrInputSize)
        cfg = model_config();
    elseif isstruct(cfgOrInputSize)
        cfg = cfgOrInputSize;
    else
        cfg = model_config();
        cfg.image.input_size(1:numel(cfgOrInputSize)) = cfgOrInputSize;
    end

    % 2. Image Ingestion
    if ischar(imgInput) || isstring(imgInput)
        if ~isfile(imgInput)
            error('predictDR:FileNotFound', 'Image file not found: %s', imgInput);
        end
        img = imread(char(imgInput));
    else
        img = imgInput;
    end

    if isempty(img)
        error('predictDR:EmptyInput', 'Input image cannot be empty.');
    end

    % Ensure 3-channel RGB
    if ndims(img) == 2
        img = repmat(img, [1, 1, 3]);
    elseif size(img, 3) == 1
        img = repmat(img, [1, 1, 3]);
    elseif size(img, 3) > 3
        img = img(:, :, 1:3);
    end

    % 3. Preprocessing (Exact PyTorch torchvision Parity)
    % A. Native Pillow-exact BILINEAR resize (bit-level parity with PIL Image.BILINEAR)
    targetH = cfg.image.input_size(1);
    targetW = cfg.image.input_size(2);
    resizedImg = pil_bilinear_resize(img, [targetH, targetW]);

    % B. Scale uint8 [0, 255] to single float [0.0, 1.0] (equivalent to ToTensor)
    singleImg = single(resizedImg) / 255.0;

    % C. Channel-wise ImageNet Normalization
    meanVal = reshape(single(cfg.image.normalization.mean), [1, 1, 3]);
    stdVal  = reshape(single(cfg.image.normalization.std),  [1, 1, 3]);
    normImg = (singleImg - meanVal) ./ stdVal;

    numClasses = cfg.model.num_classes;

    % 4. Model Forward Pass
    % PHASE 2: real inference only. The uniform-probability placeholder has
    % been removed per Rule 11; errors now propagate instead of silently
    % masking model failure.
    isPlaceholder = isstruct(net) && isfield(net, 'is_placeholder') && net.is_placeholder;

    if isPlaceholder
        error('predictDR:PlaceholderModel', ...
            'predictDR no longer supports the placeholder descriptor; load the real network with loadModel().');
    end

    if isa(net, 'dlnetwork')
        % Batch dimension required: [224, 224, 3, 1] with 'SSCB' labels.
        batchImg = reshape(normImg, [targetH, targetW, 3, 1]);
        try
            dlX = dlarray(batchImg, 'SSCB');
            rawOut = predict(net, dlX);
        catch
            % Retry with NCHW layout (1, 3, 224, 224) labelled 'CSSB'.
            permuted = permute(batchImg, [3, 1, 2, 4]);
            dlX = dlarray(permuted, 'CSSB');
            rawOut = predict(net, dlX);
        end
        logits = extractdata(rawOut);
    elseif isa(net, 'DAGNetwork') || isa(net, 'SeriesNetwork')
        logits = predict(net, normImg);
    else
        error('predictDR:UnsupportedNetwork', ...
            'Unsupported network type: %s. Expected dlnetwork.', class(net));
    end

    % Ensure logits is a 1x5 row vector
    logits = double(reshape(logits, [1, numClasses]));

    % Numerically stable Softmax over the 5 class logits
    expLogits = exp(logits - max(logits));
    probs = expLogits / sum(expLogits);

    % 5. Determine Grade and Class
    [maxProb, classIdx] = max(probs);
    grade = classIdx - 1; % 0-indexed grade (0 to 4)

    classNames = cfg.classes.names;
    predLabel = classNames{grade + 1};
    isReferable = (grade >= cfg.classes.referral_threshold);

    predStruct = struct();
    predStruct.grade = grade;
    predStruct.label = predLabel;
    predStruct.confidence = struct('raw', maxProb, 'calibrated', NaN);
    predStruct.referable = isReferable;

end
