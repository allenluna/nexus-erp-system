from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException
class Conflict(APIException):
    status_code = 409
    default_detail = "Conflicting business operation."
def handler(exc, ctx):
    r = exception_handler(exc, ctx)
    if r is None:
        return None
    d = r.data
    if isinstance(d, dict) and "detail" in d:
        r.data = {"success": False, "message": str(d["detail"]), "errors": None}
    else:
        r.data = {"success": False, "message": "Validation failed", "errors": d}
    return r
