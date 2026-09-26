function result = analyzeNeovascularization(vessels)
%ANALYZENEOVASCULARIZATION Create a prototype vessel-pattern indicator.
% This is not a neovascularization detector and is not clinically validated.

density = vessels.density;
branching = vessels.features.branching_proxy;
result = struct();
result.indicator = "research_prototype";
result.score = min(1, density * 2 + min(branching / 1000, 0.5));
result.features = struct('vessel_density', density, ...
    'branching_proxy', branching, ...
    'tortuosity_proxy', vessels.features.tortuosity_proxy);
result.warning = "Requires annotated clinical data before diagnostic use.";
end