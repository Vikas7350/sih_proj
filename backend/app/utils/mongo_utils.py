from bson import ObjectId


def strip_id(doc: dict) -> dict:
    if not doc or not isinstance(doc, dict):
        return doc
    d = dict(doc)
    d.pop("_id", None)
    for k, v in list(d.items()):
        if isinstance(v, ObjectId):
            d[k] = str(v)
        elif isinstance(v, dict):
            d[k] = strip_id(v)
        elif isinstance(v, list):
            d[k] = [strip_id(x) if isinstance(x, dict) else (str(x) if isinstance(x, ObjectId) else x) for x in v]
    return d
