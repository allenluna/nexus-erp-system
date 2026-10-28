from django.core import signing
from rest_framework import authentication, exceptions
from erp import repositories as repo
class DemoUser:
    is_authenticated = True
    def __init__(self, u): self.data, self.role = u, u["role"]
def make_token(uid): return signing.dumps({"uid": uid}, salt="erp")  # stateless: works on serverless
class TokenAuth(authentication.BaseAuthentication):
    def authenticate(self, request):
        h = request.headers.get("Authorization", "")
        if not h.startswith("Bearer "): return None
        try: uid = signing.loads(h[7:], salt="erp", max_age=43200)["uid"]
        except signing.BadSignature: raise exceptions.AuthenticationFailed("Invalid or expired token.")
        u = repo.get("users", uid)
        if not u or not u.get("active", True): raise exceptions.AuthenticationFailed("User not found.")
        return (DemoUser(u), None)
    def authenticate_header(self, request): return "Bearer"
