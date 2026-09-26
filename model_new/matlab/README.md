# MATLAB Retinal Analysis Prototype

This folder contains configurable MATLAB image-processing prototypes that sit
around the existing Python EfficientNet-B0 classifier. They do not replace the
classifier and their outputs must not be treated as clinically validated
diagnoses or lesion segmentations.

Run the complete MATLAB pipeline with:

```matlab
result = runRetinalAnalysis("path/to/fundus.png", "OutputDir", "results/matlab");
```

The pipeline produces original/enhanced images, quality metrics, optic-disc and
fovea estimates, vessel and lesion candidate masks, visual overlays, and a JSON
summary. All thresholds are engineering parameters and are exposed in the
configuration returned by `defaultRetinalConfig.m`.

MATLAB and the Image Processing Toolbox are required to execute these files.