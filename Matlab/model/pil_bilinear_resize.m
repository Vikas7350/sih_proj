function imOut = pil_bilinear_resize(imIn, targetSize)
% PIL_BILINEAR_RESIZE Exact MATLAB-native equivalent of Pillow Image.BILINEAR resize
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
% Workstream: Person A — AI/MATLAB
%
% Description:
%   Faithfully reproduces the C implementation of Pillow's BILINEAR resampling
%   (libImaging/Resample.c) used by PyTorch torchvision transforms.
%   Uses the exact 22-bit fixed-point convolution weights, coordinate mapping,
%   and integer rounding to ensure bit-level parity with Python PIL.
%
% Syntax:
%   imOut = pil_bilinear_resize(imIn, [targetH, targetW])
%
% Inputs:
%   imIn       - Input RGB image (uint8 matrix of size HxWx3 or HxW)
%   targetSize - 1x2 vector [targetHeight, targetWidth], e.g. [224, 224]
%
% Output:
%   imOut      - Resized RGB image (uint8 matrix of size targetHxtargetWx3)
%
% Reference:
%   Python Pillow libImaging/Resample.c:
%   - Filter: Bilinear (triangle kernel, support = 1.0 * max(1.0, scale))
%   - Fixed-point precision: PRECISION_BITS = 22
%   - Separable 2-pass resampling: horizontal pass, then vertical pass.

    if nargin < 2 || isempty(targetSize)
        targetSize = [224, 224];
    end

    outH = targetSize(1);
    outW = targetSize(2);

    % Ensure input is uint8
    if ~isa(imIn, 'uint8')
        imIn = uint8(round(imIn));
    end

    % Ensure 3 channels
    if ndims(imIn) == 2
        imIn = repmat(imIn, [1, 1, 3]);
    elseif size(imIn, 3) == 1
        imIn = repmat(imIn, [1, 1, 3]);
    elseif size(imIn, 3) > 3
        imIn = imIn(:, :, 1:3);
    end

    [inH, inW, numChannels] = size(imIn);

    % Fast path: identical dimensions
    if inH == outH && inW == outW
        imOut = imIn;
        return;
    end

    PRECISION_BITS = 22;
    half = 2^(PRECISION_BITS - 1);       % 2^21
    scaleDivisor = 2^PRECISION_BITS;     % 2^22

    % -------------------------------------------------------------
    % Pass 1: Horizontal Resampling (inW -> outW)
    % -------------------------------------------------------------
    [hXmin, hCount, hWeights] = compute_coeffs(inW, outW, PRECISION_BITS);

    imHoriz = zeros(inH, outW, numChannels, 'uint8');
    for xx = 1:outW
        xmin = hXmin(xx);
        count = hCount(xx);
        kW = reshape(hWeights{xx}, [1, count, 1]); % 1 x count x 1 double

        % Extract strip across all rows and channels: [inH, count, numChannels]
        patch = double(imIn(:, xmin:(xmin + count - 1), :));
        
        % Multiply and accumulate
        acc = sum(patch .* kW, 2) + half;
        
        % Fixed-point integer division (matches Pillow c >> 22) and clip
        val = floor(acc / scaleDivisor);
        val = max(0, min(255, val));
        imHoriz(:, xx, :) = uint8(val);
    end

    % -------------------------------------------------------------
    % Pass 2: Vertical Resampling (inH -> outH)
    % -------------------------------------------------------------
    [vYmin, vCount, vWeights] = compute_coeffs(inH, outH, PRECISION_BITS);

    imOut = zeros(outH, outW, numChannels, 'uint8');
    for yy = 1:outH
        ymin = vYmin(yy);
        count = vCount(yy);
        kH = reshape(vWeights{yy}, [count, 1, 1]); % count x 1 x 1 double

        % Extract strip across all columns and channels: [count, outW, numChannels]
        patch = double(imHoriz(ymin:(ymin + count - 1), :, :));
        
        % Multiply and accumulate
        acc = sum(patch .* kH, 1) + half;
        
        % Fixed-point integer division and clip
        val = floor(acc / scaleDivisor);
        val = max(0, min(255, val));
        imOut(yy, :, :) = uint8(val);
    end

end

% =========================================================================
% Helper: Compute Pillow Resample Coefficients
% =========================================================================
function [boundsXmin, boundsCount, weightsCell] = compute_coeffs(inSize, outSize, precisionBits)
    scale = double(inSize) / double(outSize);
    filterscale = max(1.0, scale);
    support = 1.0 * filterscale;

    boundsXmin = zeros(outSize, 1);
    boundsCount = zeros(outSize, 1);
    weightsCell = cell(outSize, 1);

    multFactor = double(2^precisionBits);

    for xx = 0:(outSize - 1)
        center = (double(xx) + 0.5) * scale;
        
        % Pillow C: xmin = (int)(center - support + 0.5); if (xmin < 0) xmin = 0;
        xmin = floor(center - support + 0.5);
        if xmin < 0
            xmin = 0;
        end
        
        % Pillow C: xmax = (int)(center + support + 0.5); if (xmax > inSize) xmax = inSize;
        xmax = floor(center + support + 0.5);
        if xmax > inSize
            xmax = inSize;
        end
        
        count = xmax - xmin;
        
        % Compute triangle filter weights: max(0.0, 1.0 - abs(x) / filterscale)
        xIndices = (0:(count - 1)) + double(xmin);
        d = abs(xIndices - center + 0.5) / filterscale;
        w = max(0.0, 1.0 - d);
        
        totalW = sum(w);
        if totalW ~= 0.0
            w = w / totalW;
        end
        
        % Pillow C normalize_coeffs_8bpc:
        % kk[x] = (int)(0.5 + prekk[x] * (1 << PRECISION_BITS));
        kW = floor(0.5 + w * multFactor);
        
        % Store 1-based start index and weight vector
        boundsXmin(xx + 1) = xmin + 1;
        boundsCount(xx + 1) = count;
        weightsCell{xx + 1} = kW;
    end
end
