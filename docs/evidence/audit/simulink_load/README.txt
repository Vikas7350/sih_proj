=== SIMULINK MODEL LOAD CHECK ===
Date: 2026-09-23
Status: PASSED (evidence merged into simulink_blocks/)

The model file loads successfully in MATLAB R2026a:
  model = slx:
  D:\SIH\2026\new netracare\model\telemedicine_screening_system.slx
  load_system('telemedicine_screening_system') -> no error
  Solver: VariableStepAuto (default), StopTime 36000.

Full load output (model status + name) is captured in
  simulink_blocks/stdout.txt  (first lines of that file).