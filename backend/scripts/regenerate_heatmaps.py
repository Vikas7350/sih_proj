"""Regenerate Grad-CAM heatmaps for existing screenings whose heatmap files
are missing from disk or predate the visible-overlay fix.

Run BEFORE starting the app (or whenever the model service is up):
    python scripts/regenerate_heatmaps.py [screening_id ...]
Without args, processes every completed screening that has no heatmap file
on disk (or all if --all is passed).

Calls the running model service (MODEL_SERVICE_URL) the same way the analyze
endpoint does, then saves the returned heatmap PNG and updates the signed URL.
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))
os.environ.setdefault("OMP_NUM_THREADS", "1")

from app.core.config import MODEL_SERVICE_URL, HEATMAP_DIR
from app.core.database import connect_db, get_db
from app.core.signed_url import sign_url


def regen(screenings, model_url, overwrite):
    db = get_db()
    for s in screenings:
        sid = s["screening_id"]
        img_path = s.get("image_path")
        if not img_path:
            print(f"[skip] {sid}: no image_path")
            continue
        abs_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), *img_path.replace("\\", "/").split("/")
        )
        if not os.path.exists(abs_path):
            print(f"[skip] {sid}: image missing on disk ({img_path})")
            continue

        fn = f"{sid}.png"
        out = os.path.join(HEATMAP_DIR, fn)
        if os.path.exists(out) and not overwrite:
            print(f"[skip] {sid}: heatmap exists (use --all to redo)")
            continue

        try:
            with open(abs_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode()
            body = json.dumps({"image_b64": img_b64, "screening_id": sid}).encode()
            req = urllib.request.Request(
                model_url + "/predict", data=body, headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=180) as resp:
                result = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            print(f"[fail] {sid}: model service HTTP {e.code}: {e.read()[:200]}")
            continue
        except Exception as e:
            print(f"[fail] {sid}: {e}")
            continue

        if result.get("status") != "completed":
            print(f"[fail] {sid}: model returned {result.get('status')}")
            continue

        hb = result.get("heatmap_b64")
        if not hb:
            print(f"[fail] {sid}: no heatmap returned (gradcam_error: {result.get('gradcam_error')})")
            continue

        os.makedirs(HEATMAP_DIR, exist_ok=True)
        with open(out, "wb") as f:
            f.write(base64.b64decode(hb))

        url = sign_url("heatmaps", fn)
        db.screenings.update_one(
            {"screening_id": sid},
            {"$set": {"explanation.heatmap_url": url}},
        )
        print(f"[ok]   {sid}: heatmap saved + URL updated")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="specific screening ids to regenerate")
    ap.add_argument("--all", action="store_true", help="regenerate even if a heatmap file already exists")
    ap.add_argument("--missing-only", action="store_true", help="only screenings with no heatmap file (default when no ids)")
    args = ap.parse_args()

    connect_db()
    db = get_db()

    if args.ids:
        screenings = [db.screenings.find_one({"screening_id": i}) for i in args.ids]
        screenings = [s for s in screenings if s]
    else:
        q = {"status": "completed"}
        screenings = list(db.screenings.find(q))

    if args.ids or args.all:
        overwrite = True
    else:
        overwrite = False

    model_url = MODEL_SERVICE_URL.rstrip("/")
    print(f"Using model service: {model_url}")
    print(f"Target: {len(screenings)} screening(s)")
    regen(screenings, model_url, overwrite=overwrite)


if __name__ == "__main__":
    main()
