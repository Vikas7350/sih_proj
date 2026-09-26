import requests, time, sys
s = requests.Session()
s.post("http://localhost:8000/api/auth/login", json={"email":"demo@netracare.in","password":"Demo@123"})
t0=time.time()
r = s.post("http://localhost:3000/api/backend/screenings/SCR-0004/analyze", timeout=400)
with open("analyze_probe.log","w") as f:
    f.write(f"status={r.status_code} elapsed={time.time()-t0:.1f}\n")
    f.write(r.text[:2000])
