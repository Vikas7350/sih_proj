function ok = testInferenceReal()
% TESTINFERENCEREAL Phase 2 differential test (Rule 6): proves engine inference
% returns REAL model probabilities, not the removed uniform placeholder.
%
% Placeholder behaviour was: class probs == 0.2 exactly, all 5 classes.
% Real model output on SCR-0062 must differ from uniform by O(1) and be
% deterministic across three repeated runs.
    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    addpath(fullfile(projectRoot, 'config'));
    addpath(fullfile(projectRoot, 'model'));
    addpath(projectRoot);

    cfg = model_config();
    net = loadModel(cfg.model.onnx_file, cfg);
    assert(isa(net, 'dlnetwork'), 'Expected dlnetwork, got %s', class(net));

    img = fullfile(projectRoot, '..', 'backend', 'storage', 'uploads', 'SCR-0062.jpg');

    tolPerClass = 1e-2;          % each prob must differ from 0.2 by > 1e-2
    tolRepeat   = 1e-6;          % max cross-run prob drift allowed

    probsFirst = [];
    passed = false;
    for run = 1:3
        [grade, probs, pred] = predictDR(net, img, cfg);
        fprintf('run %d: grade=%d probs=[%s]\n', run, grade, num2str(probs, '%.4f '));

        dUniform = abs(probs - 0.2);
        if all(dUniform > tolPerClass)
            % real distribution observed
            passed = true;
        end

        assert(isstruct(pred) && isfield(pred, 'grade') ...
            && isfield(pred, 'confidence') && isfield(pred, 'referable'), ...
            'pred structure does not satisfy contract');
        if run == 1
            probsFirst = probs;
        else
            drift = max(abs(probs - probsFirst));
            assert(drift <= tolRepeat, ...
                'Non-deterministic inference: drift %g > %g', drift, tolRepeat);
        end
    end

    assert(passed, 'Model output indistinguishable from uniform placeholder.');
    fprintf('DIFFERENTIAL CHECK (Rule 6): PASS - real model inference, deterministic\n');
    ok = true;
end