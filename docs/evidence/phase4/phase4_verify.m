% PHASE4_VERIFY Phase 4 runtime verification + evidence capture (script).
% Runs the function-style MATLAB test suite, then live-verifies Stage 0-3,
% quality/enhancement/decision/Grad-CAM/retinal-evidence/contract/determinism
% with per-stage timings. Writes JSON evidence next to this file.
%
% Usage: matlab -batch "run('<repo>/docs/evidence/phase4/phase4_verify.m')"

thisDir = fileparts(mfilename('fullpath'));
repo    = fileparts(fileparts(fileparts(thisDir)));   % docs/evidence/phase4 -> repo
mDir    = fullfile(repo, 'Matlab');
uploads  = fullfile(repo, 'backend', 'storage', 'uploads');
evDir   = thisDir;

addpath(fullfile(mDir, 'config'));
addpath(fullfile(mDir, 'quality'));
addpath(fullfile(mDir, 'enhancement'));
addpath(fullfile(mDir, 'model'));
addpath(fullfile(mDir, 'xai'));
addpath(fullfile(mDir, 'evaluation'));
addpath(fullfile(mDir, 'tests'));
addpath(mDir);

cfg = model_config();
generated = char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm:ss'));
fprintf('=== PHASE 4 VERIFY start %s ===\n', generated);

%% ---- PART 1: test suite (function-style, invoked explicitly) ----
suiteNames = {'testFundusValidation', 'testQuality', 'testEnhancement', ...
              'testParity', 'testPipeline', 'testPipelinePhase2', ...
              'testPipelineEndToEnd', 'testInferenceReal'};
suite = struct('name', {}, 'passed', {}, 'elapsed_seconds', {}, 'error', {}, 'detail', {});
for i = 1:numel(suiteNames)
    name = suiteNames{i};
    fprintf('-- suite: %s\n', name);
    t = tic;
    rec = struct('name', name, 'passed', false, 'elapsed_seconds', 0, 'error', '', 'detail', '');
    try
        r = feval(name);
        rec.passed = true;
        if isstruct(r) && isfield(r, 'all_passed')
            rec.passed = logical(r.all_passed);
            rec.detail = sprintf('all_passed=%d (%d/%d)', r.all_passed, r.passed, r.total);
        elseif isstruct(r) && isfield(r, 'passed')
            rec.passed = logical(r.passed);
            rec.detail = sprintf('max_diff=%.3e', r.max_diff);
        elseif islogical(r)
            rec.passed = logical(r);
            rec.detail = sprintf('returned ok=%d', r);
        else
            rec.detail = 'ran without exception';
        end
        if ~rec.passed && isempty(rec.error)
            rec.error = 'test reported failure';
        end
    catch ME
        rec.passed = false;
        rec.error = ME.message;
    end
    rec.elapsed_seconds = round(toc(t), 2);
    suite(end+1) = rec; %#ok<SAGROW>
    fprintf('   -> passed=%d %.1fs %s\n', rec.passed, rec.elapsed_seconds, rec.error);
end
suiteSummary = struct('generated', generated, ...
    'invocation', 'explicit feval per function (runtests discovers 0: tests are function-style, not xunit)', ...
    'total', numel(suite), 'passed', sum([suite.passed]), ...
    'failed', sum(~[suite.passed]), 'results', suite);
write_json(fullfile(evDir, 'test_suite_results.json'), suiteSummary);
fprintf('suite: %d/%d passed\n', suiteSummary.passed, suiteSummary.total);

%% ---- PART 2: fixture runs (determinism x3 + matrix fixtures) ----
runSpecs = { ...
    'SCR-0062.jpg', 'P4-DET-1'; ...
    'SCR-0062.jpg', 'P4-DET-2'; ...
    'SCR-0062.jpg', 'P4-DET-3'; ...
    'SCR-0044.jpg', 'P4-G0-0044'; ...
    'SCR-0002.jpg', 'P4-NONFUNDUS'; ...
    'SCR-0050.jpg', 'P4-UNCERTAIN'};
runs = struct([]);
for i = 1:size(runSpecs, 1)
    fprintf('-- runPipeline %s (%s)\n', runSpecs{i,1}, runSpecs{i,2});
    rec = run_one(fullfile(uploads, runSpecs{i,1}), runSpecs{i,1}, runSpecs{i,2}, ...
                  fullfile(evDir, 'gradcam_results.json'));
    if isempty(runs), runs = rec; else, runs(end+1) = rec; end %#ok<SAGROW>
end

det = runs(1:3);
determinism = struct( ...
    'fixture', 'SCR-0062.jpg', 'runs', 3, ...
    'identical_grade',      all([det.grade] == det(1).grade), ...
    'identical_confidence', all(abs([det.confidence_raw] - det(1).confidence_raw) < 1e-12), ...
    'identical_action',     all(strcmp({det.action}, det(1).action)), ...
    'identical_decision',   all(strcmp({det.decision}, det(1).decision)), ...
    'identical_quality',    all(strcmp({det.quality_status}, det(1).quality_status)), ...
    'confidence_values',    [det.confidence_raw], ...
    'elapsed_seconds',      [det.elapsed_seconds]);

requiredFields = {'screening_id','stage','status','action','decision','fundus', ...
    'quality','enhancement','prediction','confidence','referable','xai', ...
    'evidence','reasons','model_version','pipeline_version'};
allContractOk = true;
for i = 1:numel(runs)
    allContractOk = allContractOk && isempty(runs(i).contract_missing);
end

%% ---- PART 3: per-stage timings (warm, single session; excludes matlab -batch startup) ----
img62 = imread(fullfile(uploads, 'SCR-0062.jpg'));
st = struct();
t = tic; f0 = checkFundusImage(img62, cfg);            st.stage0_checkFundusImage = round(toc(t), 4);
t = tic; [q1, q1acc] = assessQuality(img62, cfg);      st.stage1_assessQuality = round(toc(t), 4);
t = tic; e2 = enhanceBorderline(img62, cfg);           st.stage2_enhanceBorderline_GOOD_bypass = round(toc(t), 4);
t = tic; net = loadModel(cfg.model.mat_file, cfg);     st.model_load_mat = round(toc(t), 4);
t = tic; [g3, ~, ps3] = predictDR(net, img62, cfg);    st.stage3_predictDR = round(toc(t), 4);
t = tic; [hm3, gp3] = generateGradCAM(net, img62, g3+1, cfg); st.gradcam_generate = round(toc(t), 4);
st.full_pipeline_SCR0062 = runs(1).elapsed_seconds;
st.evidence_seconds_reported_by_pipeline = runs(1).evidence_seconds;
st.note = 'Warm in-session component timings; matlab -batch cold start (~40-60s) excluded. Full-pipeline wall includes imread, all stages, JSON encode.';

%% ---- PART 4: quality + enhancement over all verified fixtures ----
qfiles = {'SCR-0062.jpg','SCR-0044.jpg','SCR-0050.jpg','SCR-0001.jpg','SCR-0002.jpg', ...
          'SCR-0003.jpg','SCR-0004.jpg','SCR-0055.jpg','SCR-0066.jpg'};
qrecs = {}; erecs = {};
for i = 1:numel(qfiles)
    p = fullfile(uploads, qfiles{i});
    if ~isfile(p), continue; end
    q = assessQuality(p, cfg);
    qrecs{end+1} = struct('image', qfiles{i}, 'status', char(q.status), ...
        'overallScore', q.overallScore, 'scores', q.scores, 'reasons', {q.reasons}); %#ok<SAGROW>
    e = enhanceBorderline(p, cfg);
    erecs{end+1} = struct('image', qfiles{i}, ...
        'before', char(e.beforeQuality.status), 'after', char(e.afterQuality.status), ...
        'applied', logical(e.applied), 'improved', logical(e.improved), ...
        'beforeScore', e.beforeQuality.overallScore, 'afterScore', e.afterQuality.overallScore, ...
        'method', char(e.method), 'reasons', {e.reasons}); %#ok<SAGROW>
end
blackImg = uint8(zeros(224, 224, 3));
[qB, accB] = assessQuality(blackImg, cfg);
[eB, ~] = enhanceBorderline(blackImg, cfg);
synth = struct('black_image_quality_status', char(qB.status), ...
    'black_image_acceptable', logical(accB), ...
    'black_image_enhance_applied', logical(eB.applied), ...
    'note', 'Synthetic degenerate inputs only (code-path proof); no fabricated clinical/borderline fixture exists in repo.');
qualityOut = struct('generated', generated, ...
    'source', 'Matlab/quality/assessQuality.m (Stage 1)', ...
    'fixtures', {qrecs}, 'synthetic_checks', synth);
write_json(fullfile(evDir, 'quality_results.json'), qualityOut);
enhOut = struct('generated', generated, ...
    'source', 'Matlab/enhancement/enhanceBorderline.m (Stage 2)', ...
    'fixtures', {erecs}, 'synthetic_checks', synth, ...
    'borderline_note', 'No natural BORDERLINE fixture in repository; Stage-2 BORDERLINE branch code-verified in runPipeline.m:176-191 only.');
write_json(fullfile(evDir, 'enhancement_results.json'), enhOut);

%% ---- PART 5: decision rule unit check ----
du = struct();
du.rule = 'referable = (grade >= cfg.classes.referral_threshold); referable->review/SPECIALIST REFERRAL, else proceed/PROCEED (predictDR.m:123, runPipeline.m:244-250)';
du.referral_threshold = cfg.classes.referral_threshold;
du.threshold_is_2 = (cfg.classes.referral_threshold == 2);
live = {};
for i = [4, 1]  % SCR-0044 (grade 0), SCR-0062 (grade 4) — indices into runs
    r = runs(i);
    expectedReferable = r.grade >= cfg.classes.referral_threshold;
    if expectedReferable, ed = 'review'; ea = 'SPECIALIST REFERRAL';
    else, ed = 'proceed'; ea = 'PROCEED'; end
    live{end+1} = struct('fixture', r.fixture, 'grade', r.grade, ...
        'referable', logical(r.referable), 'decision', r.decision, 'action', r.action, ...
        'formula_referable', expectedReferable, 'expected_decision', ed, 'expected_action', ea, ...
        'consistent', logical(r.referable == expectedReferable && ...
            strcmp(r.decision, ed) && strcmp(r.action, ea))); %#ok<SAGROW>
end
% predictDR formula consistency on all three parity images
pf = jsondecode(fileread(fullfile(mDir, 'data', 'results', 'python_parity_reference_v2.json')));
formulaChecks = {};
for i = 1:numel(pf)
    [g, ~, ps] = predictDR(net, pf(i).image_path, cfg);
    formulaChecks{end+1} = struct('fixture', pf(i).image_filename, 'grade', g, ...
        'predStruct_referable', logical(ps.referable), ...
        'formula', g >= cfg.classes.referral_threshold, ...
        'consistent', logical(ps.referable == (g >= cfg.classes.referral_threshold))); %#ok<SAGROW>
end
du.live_coverage = {live};
du.predictdr_formula_checks = {formulaChecks};
du.grades_not_live_covered = [1, 2, 3];
du.grades_1_2_3_status = 'code-verified only (predictDR.m:123 formula); no fixture in repo predicts these grades';
du.stage0_nonfundus = struct('fixture', 'SCR-0002.jpg', 'decision', runs(5).decision, ...
    'action', runs(5).action, 'prediction_absent', isempty(runs(5).grade), ...
    'consistent', logical(strcmp(runs(5).decision,'reject') && strcmp(runs(5).action,'REJECT') && isempty(runs(5).grade)));
du.stage0_uncertain = struct('fixture', 'SCR-0050.jpg', 'decision', runs(6).decision, ...
    'action', runs(6).action, 'prediction_absent', isempty(runs(6).grade), ...
    'consistent', logical(strcmp(runs(6).decision,'review') && strcmp(runs(6).action,'REJECT / HUMAN REVIEW') && isempty(runs(6).grade)));
du.all_consistent = du.threshold_is_2 && ...
    all(cellfun(@(x) x.consistent, live)) && all(cellfun(@(x) x.consistent, formulaChecks)) && ...
    du.stage0_nonfundus.consistent && du.stage0_uncertain.consistent;
write_json(fullfile(evDir, 'decision_unit_test.json'), du);
fprintf('decision unit test consistent=%d\n', du.all_consistent);

%% ---- PART 6: retinal evidence — pipeline payloads + island root-cause ----
islandDir = fullfile(repo, 'model', 'matlab');
addpath(islandDir);
islandCleanup = onCleanup(@() rmpath(islandDir));
workDir = fullfile(mDir, 'data', 'results', 'retinal_evidence');
if ~isfolder(workDir), mkdir(workDir); end

pipeEv = {};
for i = [1, 4]  % SCR-0062 runs(1), SCR-0044 runs(4)
    r = runs(i);
    pipeEv{end+1} = struct('fixture', r.fixture, ...
        'evidence_status', r.evidence_status, ...
        'retinal_analysis_empty', r.evidence_retinal_empty, ...
        'processing_time_seconds', r.evidence_seconds, ...
        'has_disclaimer', r.evidence_has_disclaimer); %#ok<SAGROW>
end

islandDirect = {};
for fx = {'SCR-0062.jpg', 'SCR-0044.jpg'}
    src = fullfile(uploads, fx{1});
    img = imread(src);
    [~, stem, ~] = fileparts(src);
    inPng = fullfile(workDir, ['P4_' stem '_island_input.png']);
    imwrite(img, inPng);
    t = tic;
    try
        summary = runRetinalAnalysis(inPng, 'OutputDir', workDir);
        el = round(toc(t), 4);
        raKeys = {};
        raEmpty = true;
        if isfield(summary, 'retinal_analysis') && isstruct(summary.retinal_analysis) && ~isempty(fieldnames(summary.retinal_analysis))
            raKeys = fieldnames(summary.retinal_analysis);
            raEmpty = false;
        end
        qstat = '';
        qmetrics = struct();
        if isfield(summary, 'quality') && isstruct(summary.quality)
            qstat = char(summary.quality.status);
            if isfield(summary.quality, 'metrics'), qmetrics = summary.quality.metrics; end
        end
        counts = struct();
        if ~raEmpty
            ra = summary.retinal_analysis;
            if isfield(ra, 'optic_disc'), counts.optic_disc_found = logical(ra.optic_disc.found); end
            if isfield(ra, 'vessels'), counts.vessel_density = ra.vessels.density; end
            if isfield(ra, 'microaneurysm'), counts.microaneurysm_candidates = ra.microaneurysm.candidate_count; end
            if isfield(ra, 'exudates'), counts.exudate_candidates = ra.exudates.candidate_count; end
            if isfield(ra, 'hemorrhage'), counts.hemorrhage_candidates = ra.hemorrhage.candidate_count; end
            if isfield(ra, 'neovascularization'), counts.neovasc_indicator = char(ra.neovascularization.indicator); end
        end
        islandDirect{end+1} = struct('fixture', fx{1}, ...
            'image_size_hw', [size(img,1), size(img,2)], ...
            'elapsed_seconds', el, ...
            'summary_status', char(summary.status), ...
            'island_quality_status', qstat, ...
            'island_quality_metrics', qmetrics, ...
            'retinal_analysis_empty', raEmpty, ...
            'retinal_analysis_keys', {raKeys}, ...
            'detector_outputs', counts, ...
            'early_return_triggered', logical(strcmp(char(summary.status), 'INSUFFICIENT')), ...
            'root_cause', early_return_cause(fx{1}, size(img,2), size(img,1), qstat)); %#ok<SAGROW>
    catch ME
        islandDirect{end+1} = struct('fixture', fx{1}, 'error', ME.message); %#ok<SAGROW>
    end
end
clear islandCleanup;

retinalOut = struct('generated', generated, ...
    'pipeline_evidence_payloads', {pipeEv}, ...
    'island_direct_runs', {islandDirect}, ...
    'payload_status_note', ['runPipeline.m:354 sets evidence.status=SUCCESS whenever runRetinalAnalysis returns without throwing; ', ...
        'it does not forward summary.status. Empty retinal_analysis + SUCCESS means the island early-returned ', ...
        'on its own quality gate (runRetinalAnalysis.m:28-34), not that detectors ran and found nothing. ', ...
        'Detector claims remain candidate/heuristic wording per detector source comments.']);
write_json(fullfile(evDir, 'retinal_evidence_results.json'), retinalOut);

%% ---- PART 7: runtime summary ----
rt = struct();
rt.generated = generated;
rt.matlab_version = version;
rt.test_suite = struct('passed', suiteSummary.passed, 'total', suiteSummary.total, ...
    'failed', suiteSummary.failed, 'file', 'test_suite_results.json');
rt.stage_timings_seconds = st;
rt.full_pipeline_runs = runs;
rt.determinism = determinism;
rt.contract = struct('required_field_count', numel(requiredFields), ...
    'required_fields', {requiredFields}, 'all_runs_complete', allContractOk);
rt.decision_unit_test_all_consistent = du.all_consistent;
rt.quality_file = 'quality_results.json';
rt.enhancement_file = 'enhancement_results.json';
rt.gradcam_file = 'gradcam_results.json';
rt.retinal_evidence_file = 'retinal_evidence_results.json';
rt.clinical_validation = 'NOT COMPLETED - no labelled APTOS evaluation dataset in workspace; software/runtime validation only.';
write_json(fullfile(evDir, 'runtime_summary.json'), rt);

fprintf('=== PHASE 4 VERIFY done: suite %d/%d, contract_ok=%d, det_ok=%d, decision_ok=%d ===\n', ...
    suiteSummary.passed, suiteSummary.total, allContractOk, ...
    determinism.identical_grade && determinism.identical_confidence && determinism.identical_action, ...
    du.all_consistent);

%% ================= local functions =================

function rec = run_one(imgPath, fixture, screeningId, gradcamJsonPath)
    t = tic;
    jsonStr = runPipeline(imgPath, screeningId);
    elapsed = round(toc(t), 3);
    d = jsondecode(jsonStr);
    rec = struct();
    rec.fixture = fixture;
    rec.screening_id = screeningId;
    rec.elapsed_seconds = elapsed;
    rec.stage = char(d.stage);
    rec.status = char(d.status);
    rec.action = char(d.action);
    rec.decision = char(d.decision);
    rec.fundus_status = char(d.fundus.status);
    if isstruct(d.quality) && isfield(d.quality, 'status')
        rec.quality_status = char(d.quality.status);
        rec.quality_overall = d.quality.scores.overall;
    else
        rec.quality_status = '';
        rec.quality_overall = [];
    end
    if isstruct(d.enhancement) && isfield(d.enhancement, 'applied')
        rec.enhancement_applied = logical(d.enhancement.applied);
    else
        rec.enhancement_applied = false;
    end
    if isstruct(d.prediction) && ~isempty(d.prediction.grade)
        rec.grade = double(d.prediction.grade);
    else
        rec.grade = [];
    end
    rec.label = char(d.prediction.label);
    rec.confidence_raw = double(d.confidence.raw);
    rec.referable = logical(d.referable);
    gcPath = char(d.xai.gradcam_path);
    rec.gradcam_path = gcPath;
    rec.gradcam_bytes = 0;
    if ~isempty(gcPath) && isfile(gcPath)
        info = dir(gcPath);
        rec.gradcam_bytes = info.bytes;
    end
    if isstruct(d.evidence) && isfield(d.evidence, 'status')
        rec.evidence_status = char(d.evidence.status);
        rec.evidence_seconds = [];
        if isfield(d.evidence, 'processing_time_seconds')
            rec.evidence_seconds = double(d.evidence.processing_time_seconds);
        end
        raEmpty = true;
        if isfield(d.evidence, 'retinal_analysis') && isstruct(d.evidence.retinal_analysis) ...
                && ~isempty(fieldnames(d.evidence.retinal_analysis))
            raEmpty = false;
        end
        rec.evidence_retinal_empty = raEmpty;
        rec.evidence_has_disclaimer = isfield(d.evidence, 'candidate_disclaimer');
    else
        rec.evidence_status = '';
        rec.evidence_seconds = [];
        rec.evidence_retinal_empty = true;
        rec.evidence_has_disclaimer = false;
    end
    required = {'screening_id','stage','status','action','decision','fundus', ...
        'quality','enhancement','prediction','confidence','referable','xai', ...
        'evidence','reasons','model_version','pipeline_version'};
    have = fieldnames(d);
    rec.contract_missing = required(~ismember(required, have))';
    % append gradcam record incrementally so evidence survives a later crash
    append_gradcam(gradcamJsonPath, rec);
end

function append_gradcam(jsonPath, rec)
    if rec.gradcam_bytes <= 0 && (isempty(rec.gradcam_path) || ~isfile(rec.gradcam_path))
        return;
    end
    g = struct('generated', '', 'layer', 'x_features_featu_469', ...
        'reduction_layer', 'x_classifier_classif', 'runs', {{}});
    if isfile(jsonPath)
        try, g = jsondecode(fileread(jsonPath)); catch, end
    end
    info = struct('fixture', rec.fixture, 'screening_id', rec.screening_id, ...
        'gradcam_path', rec.gradcam_path, 'exists', isfile(rec.gradcam_path), ...
        'bytes', rec.gradcam_bytes, 'width', [], 'height', [], 'format', '', ...
        'overlay_std', [], 'note', '');
    if info.exists
        try
            ii = imfinfo(rec.gradcam_path);
            info.width = ii(1).Width;
            info.height = ii(1).Height;
            info.format = char(ii(1).Format);
            a = single(imread(rec.gradcam_path));
            info.overlay_std = round(double(std(a(:))), 3);
            if info.overlay_std == 0
                info.note = 'degenerate zero-variance overlay';
            end
        catch ME
            info.note = ME.message;
        end
    end
    if isfield(g, 'runs') && ~isempty(g.runs)
        if iscell(g.runs)
            entries = g.runs;
        else
            entries = num2cell(g.runs(:).');
        end
        entries{end+1} = info; %#ok<AGROW>
        g.runs = entries;
    else
        g.runs = {info};
    end
    g.generated = char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm:ss'));
    write_json(jsonPath, g);
end

function cause = early_return_cause(fixture, width, height, qstat)
    if strcmp(qstat, 'INSUFFICIENT') || strcmp(qstat, '')
        cause = sprintf(['%s is %dx%d; island gate defaultRetinalConfig minWidth=640 minHeight=480 ', ...
            '(minWidth check fails at width=%d<640 or minHeight %d<480) -> quality INSUFFICIENT -> ', ...
            'runRetinalAnalysis.m:28-34 early return with retinal_analysis=struct() (encodes {}).'], ...
            fixture, width, height, width, height);
        if width >= 640 && height >= 480
            cause = sprintf(['%s is %dx%d (passes resolution); island quality status=%s -> ', ...
                'early return path runRetinalAnalysis.m:28-34 if INSUFFICIENT.'], ...
                fixture, width, height, qstat);
        end
    else
        cause = sprintf('%s island quality=%s; early-return path not taken.', fixture, qstat);
    end
end

function write_json(path, s)
    txt = jsonencode(s, 'PrettyPrint', true);
    fid = fopen(path, 'w', 'n', 'UTF-8');
    if fid == -1
        error('phase4:writeFailed', 'Cannot open %s', path);
    end
    fwrite(fid, txt, 'char');
    fclose(fid);
end
