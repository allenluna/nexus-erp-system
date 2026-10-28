from django.contrib.auth.hashers import check_password
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound, PermissionDenied, AuthenticationFailed
from core.authentication import make_token
from . import repositories as repo, services as S

ALL = {"Admin"}
ACCESS = {"employees": {"HR"}, "departments": {"HR"}, "attendance": {"HR"}, "leaveRequests": {"HR"}, "customers": {"Sales"}, "leads": {"Sales"},
  "suppliers": {"Inventory", "Finance"}, "categories": {"Inventory", "Sales"}, "products": {"Inventory", "Sales"}, "salesOrders": {"Sales"},
  "purchaseOrders": {"Inventory"}, "invoices": {"Finance"}, "expenses": {"Finance"}, "users": set(), "activityLogs": set()}
READ_EXTRA = {"customers": {"Finance"}, "invoices": {"Sales"}, "departments": {"Sales", "Finance", "Inventory"}}
READ_ONLY = {"activityLogs"}
SENSITIVE = {"employees": ("salary",), "users": ("passwordHash",)}

def ok(data=None, msg="Operation completed successfully", status=200, **extra):
    return Response({"success": True, "data": data, "message": msg, **extra}, status=status)
def check(user, col, write):
    if col not in ACCESS: raise NotFound("Unknown resource.")
    if write and col in READ_ONLY: raise PermissionDenied("This collection is read-only.")
    allowed = ALL | ACCESS[col] | (set() if write else READ_EXTRA.get(col, set()))
    if user.role not in allowed: raise PermissionDenied("Your role cannot perform this action.")
def public(col, rec, user):
    hide = set(SENSITIVE.get(col, ()))
    if col == "employees" and user is not None and user.role in ("Admin", "HR"): hide = set()
    return {k: v for k, v in rec.items() if k not in hide}
def actor(request): return request.user.data["email"]

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    u = next((x for x in repo.read()["users"] if x["email"].lower() == str(request.data.get("email", "")).lower()), None)
    if not u or not u.get("active", True) or not check_password(str(request.data.get("password", "")), u["passwordHash"]):
        raise AuthenticationFailed("Invalid email or password.")
    return ok({"token": make_token(u["id"]), "user": public("users", u, None)}, "Logged in")
@api_view(["GET"])
def me(request): return ok(public("users", request.user.data, None))
@api_view(["GET"])
def summary(request): return ok(S.summary(repo.read()))

class Col(APIView):
    def get(self, request, col):
        check(request.user, col, False); q = request.query_params
        rows = [public(col, r, request.user) for r in repo.read()[col]]
        for k, v in q.items():
            if k not in ("q", "page", "limit", "sort") and rows and k in rows[0]: rows = [r for r in rows if str(r.get(k)) == v]
        if q.get("q"): rows = [r for r in rows if q["q"].lower() in " ".join(str(v) for v in r.values() if not isinstance(v, (list, dict))).lower()]
        if q.get("sort"):
            f = q["sort"].lstrip("-"); rows.sort(key=lambda r: str(r.get(f, "")), reverse=q["sort"].startswith("-"))
        try: page, limit = max(int(q.get("page", 1)), 1), min(max(int(q.get("limit", 10)), 1), 100)
        except ValueError: page, limit = 1, 10
        total = len(rows)
        return ok(rows[(page - 1) * limit: page * limit], "", pagination={"page": page, "limit": limit, "total": total, "totalPages": -(-total // limit)})
    def post(self, request, col):
        check(request.user, col, True)
        return ok(public(col, S.create(actor(request), col, dict(request.data)), request.user), "Created", 201)
class Item(APIView):
    def get(self, request, col, id):
        check(request.user, col, False)
        r = repo.get(col, id)
        if not r: raise NotFound("Record not found.")
        return ok(public(col, r, request.user))
    def _upd(self, request, col, id):
        check(request.user, col, True); return ok(public(col, S.update(actor(request), col, id, dict(request.data)), request.user), "Updated")
    put = patch = _upd
    def delete(self, request, col, id):
        check(request.user, col, True); S.delete(actor(request), col, id); return ok(None, "Deleted")
class Act(APIView):
    def post(self, request, col, id, action):
        check(request.user, col, True)
        return ok(public(col, S.run_action(actor(request), col, id, action, request.data), request.user), "Done")
