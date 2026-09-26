function summary = run_all_matlab_phase6_tests()
% RUN_ALL_MATLAB_PHASE6_TESTS Master test runner for Phase 6 MATLAB validation
%
% NetraCare - Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038

    fprintf('========================================================================================\n');
    fprintf(' NetraCare SIH 26038: Phase 6 Master MATLAB Test Suite Execution\n');
    fprintf('========================================================================================\n\n');

    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    addpath(fullfile(projectRoot, 'config'));
    addpath(fullfile(projectRoot, 'quality'));
    addpath(fullfile(projectRoot, 'enhancement'));
    addpath(fullfile(projectRoot, 'model'));
    addpath(fullfile(projectRoot, 'xai'));
    addpath(fullfile(projectRoot, 'evaluation'));
    addpath(fullfile(projectRoot, 'tests'));
    addpath(projectRoot);

    tests = {
        'testFundusValidation';
        'testQuality';
        'testEnhancement';
        'testInferenceReal';
        'testParity';
        'testPipeline';
        'testPipelineEndToEnd';
    };

    numTests = numel(tests);
    passedCount = 0;
    failedCount = 0;
    summary = struct();

    for i = 1:numTests
        testName = tests{i};
        fprintf('\n>>> Running %s ...\n', testName);
        try
            fh = str2func(testName);
            res = fh();
            if isstruct(res) && isfield(res, 'all_passed') && ~res.all_passed
                error('TestPipeline:InternalFailure', ...
                      '%d of %d internal assertions failed', ...
                      res.total - res.passed, res.total);
            end
            fprintf('>>> %s: PASSED\n', testName);
            passedCount = passedCount + 1;
            summary.(testName) = 'PASSED';
        catch ME
            fprintf(2, '>>> %s: FAILED (%s: %s)\n', testName, ME.identifier, ME.message);
            failedCount = failedCount + 1;
            summary.(testName) = sprintf('FAILED: %s', ME.message);
        end
    end

    fprintf('\n========================================================================================\n');
    fprintf(' MATLAB Test Suite Summary: %d Passed, %d Failed (Total: %d)\n', passedCount, failedCount, numTests);
    fprintf('========================================================================================\n');
end
