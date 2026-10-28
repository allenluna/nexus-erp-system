import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
ON_VERCEL = bool(os.environ.get("VERCEL"))
DEBUG = os.environ.get("DJANGO_DEBUG", "0" if ON_VERCEL else "1") == "1"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key")
if ON_VERCEL and SECRET_KEY == "dev-only-insecure-key":
    raise RuntimeError("Set DJANGO_SECRET_KEY in Vercel project settings.")
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,.vercel.app").split(",")
INSTALLED_APPS = ["corsheaders", "rest_framework", "erp"]
MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", "django.middleware.security.SecurityMiddleware",
              "django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {}  # no relational DB; business data lives in the JSON file
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["core.authentication.TokenAuth"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "core.exceptions.handler",
}
ERP_SEED_PATH = BASE_DIR / "data" / "seed.json"
# Vercel's filesystem is read-only except /tmp, and /tmp is ephemeral per instance.
ERP_DB_PATH = Path("/tmp/db.json") if ON_VERCEL else Path(os.environ.get("ERP_DB_PATH", BASE_DIR / "data" / "db.json"))
