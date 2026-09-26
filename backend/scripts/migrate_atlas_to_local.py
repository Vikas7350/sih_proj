"""One-time migration: Atlas (users, phcs, otps) -> local dr_screening.

Usage:
  MONGODB_URI=mongodb+srv://... python scripts/migrate_atlas_to_local.py --dry-run
  MONGODB_URI=mongodb+srv://... python scripts/migrate_atlas_to_local.py
  MONGODB_URI=mongodb+srv://... python scripts/migrate_atlas_to_local.py --backup atlas_backup.json

Reads from the Atlas URI in MONGODB_URI. --backup writes a raw JSON snapshot of
the Atlas collections (ObjectIds/datetimes intact) to PATH -- run this before
decommissioning Atlas. Otherwise it writes into the local DB defined by
MONGODB_URL/DATABASE_NAME: __v is dropped, Mongoose `createdAt` is remapped to
`created_at`, and `_id` is preserved so `users.phc_id` references stay valid
with no rewriting. Atlas itself is never modified.

ponytail: one-time script; relies on find/insert/count output as its verifier.
"""

import argparse
import os
import sys
from typing import Dict, Optional

# make `python scripts/<this>.py` work from the backend dir
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bson.json_util import dumps as bson_dumps
from pymongo import MongoClient

# fail fast if backend deps not installed
from app.core.config import MONGODB_URL, DATABASE_NAME  # noqa: F401

COLLECTIONS = ("users", "phcs", "otps")

_FIELD_REMAP = {"createdAt": "created_at", "updatedAt": "updated_at"}
# Mongoose-only fields: never migrate.
_DROP_FIELDS = ("__v", "_id", *tuple(_FIELD_REMAP.keys()))


def _atlas_db() -> Optional[MongoClient]:
    atlas_uri = os.getenv("MONGODB_URI", "")
    if not atlas_uri:
        print(
            "FATAL: MONGODB_URI environment variable not set "
            "(the deployment-only Atlas connection string).",
            file=sys.stderr,
        )
        return None
    return MongoClient(atlas_uri, serverSelectionTimeoutMS=5000).get_database()


def _clean(doc: Dict) -> dict:
    out = {}
    for k, v in doc.items():
        if k in _DROP_FIELDS:
            continue
        out[_FIELD_REMAP.get(k, k)] = v
    return out


def backup(path: str) -> int:
    """Snapshot Atlas collections to a JSON file, untouched for Mongo insert."""
    src = _atlas_db()
    if src is None:
        return 2
    payload = {}
    for coll in COLLECTIONS:
        docs = list(src[coll].find())
        payload[coll] = docs
        print(f"[{coll}] backed up {len(docs)}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(bson_dumps(payload, indent=2))
    src.client.close()
    print(f"backup written to {path}")
    return 0


def migrate(dry_run: bool) -> int:
    src = _atlas_db()
    if src is None:
        return 2
    dst = MongoClient(MONGODB_URL)[DATABASE_NAME]

    total_errors = 0
    for coll in COLLECTIONS:
        docs = list(src[coll].find())
        cleaned = [_clean(d) for d in docs]
        written = 0
        write_errors = 0
        if not dry_run:
            for doc in cleaned:
                try:
                    dst[coll].insert_one(doc)
                    written += 1
                except Exception as e:
                    write_errors += 1
                    print(f"  ERROR {coll} skip {doc.get('email', doc.get('code'))}: {e}")
        else:
            written = len(cleaned)
        print(f"[{coll}] read={len(docs)} written={written} errors={write_errors}")
        total_errors += write_errors

    if not dry_run:
        _verify_refs(dst)

    src.client.close()
    dst.client.close()
    return 0 if total_errors == 0 else 1


def _verify_refs(dst) -> None:
    """Spot-check that every migrated user.phc_id resolves to a phcs doc."""
    phc_ids = {p["_id"] for p in dst.phcs.find({}, {"_id": 1})}
    dangling = [
        u.get("email")
        for u in dst.users.find({"phc_id": {"$ne": None}}, {"_id": 0, "email": 1, "phc_id": 1})
        if u.get("phc_id") not in phc_ids
    ]
    print(f"[refs] users with unresolvable phc_id: {len(dangling)}")
    for email in dangling[:10]:
        print(f"  DANGLING phc_id: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would be written without inserting anything",
    )
    parser.add_argument(
        "--backup",
        metavar="PATH",
        help="write a raw JSON snapshot of the Atlas collections to PATH (no DB changes)",
    )
    args = parser.parse_args()
    if args.dry_run and args.backup:
        parser.error("--dry-run and --backup are mutually exclusive")
    if args.backup:
        sys.exit(backup(args.backup))
    sys.exit(migrate(args.dry_run))