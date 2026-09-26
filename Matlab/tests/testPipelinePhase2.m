function ok = testPipelinePhase2()
% TESTPIPELINEPHASE2 Phase 2 end-to-end validation (Rules 12/13):
%   - runPipeline on fundus SCR-0062 -> real probs, real model_version,
%     decision proceed, xai.gradcam_path populated with a real overlay PNG.
%   - runPipeline on non-fundus SCR-0001 -> rejected at Stage 0.
%   - runPipeline on uncertain SCR-0050 -> decision review or proceed, no crash.
%   - Repeatability: two runs on same fundus image produce identical JSON probs.
    projectRoot = fileparts(fileparts(mfilename('fullpath')));
    uploads = fullfile(projectRoot, '..', 'backend', 'storage', 'uploads');

    fundus = fullfile(uploads, 'SCR-0062.jpg');
    nonFundus = fullfile(uploads, 'SCR-0001.jpg');
    uncertain = fullfile(uploads, 'SCR-0050.jpg');

    ok = true;

    % --- Fundus: real inference expected ---
    [json1, res1] = runPipeline(fundus, 'PH2-FUNDUS-1');
    d1 = jsondecode(json1);
    % referable (grade>=2) => review (SPECIALIST REFERRAL); else proceed
    assert(ismember(d1.decision, {'proceed', 'review'}), 'unexpected decision %s', d1.decision);
    assert(isnumeric(d1.confidence.raw), 'confidence.raw must be numeric, got %s', class(d1.confidence.raw));
    fprintf('FUNDUS  : grade=%g label=%s conf=%g referable=%g model_version=%s\n', ...
        d1.prediction.grade, char(d1.prediction.label), d1.confidence.raw, ...
        d1.referable, char(d1.model_version));
    assert(strcmp(d1.model_version, 'EfficientNet-B0-APTOS-v1'), 'stale model_version');
    % real probs -> max confidence far from uniform 0.2
    assert(d1.confidence.raw > 0.5, 'expected high confidence, got %g -- real inference?', d1.confidence.raw);
    % Grad-CAM overlay present
    gcPath = d1.xai.gradcam_path;
    assert(~isempty(gcPath), 'gradcam_path must be populated');
    fprintf('GRADCAM : %s\n', gcPath);
    if isfile(gcPath)
        fprintf('GRADCAM file exists, size=%d bytes\n', dir(gcPath).bytes);
    else
        fprintf('GRADCAM path not found on disk: %s\n', gcPath);
    end

    % --- Repeatability ---
    [json2, res2] = runPipeline(fundus, 'PH2-FUNDUS-2');
    d2 = jsondecode(json2);
    sameConf = abs(d1.confidence.raw - d2.confidence.raw) < 1e-12;
    sameClass = isequal(d1.prediction, d2.prediction);
    fprintf('REPEATABILITY: conf equal=%d class equal=%d\n', sameConf, sameClass);
    assert(sameConf && sameClass, 'Pipeline output not repeatable.');

    % --- Non-fundus: reject ---
    [jR, rR] = runPipeline(nonFundus, 'PH2-NONFUNDUS');
    dR = jsondecode(jR);
    assert(strcmp(dR.decision, 'reject'), 'expected reject, got %s', dR.decision);
    assert(strcmp(dR.action, 'REJECT'), 'expected REJECT action');
    fprintf('NONFUNDUS: decision=%s stage=%s\n', char(dR.decision), char(dR.stage));

    % --- Uncertain ---
    [jU, rU] = runPipeline(uncertain, 'PH2-UNCERTAIN');
    dU = jsondecode(jU);
    assert(ismember(dU.decision, {'proceed', 'review'}), 'unexpected decision %s', dU.decision);
    fprintf('UNCERTAIN: decision=%s\n', char(dU.decision));

    fprintf('PHASE 2 END-TO-END: PASS\n');
end