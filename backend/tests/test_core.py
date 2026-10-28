import tempfile, shutil
from pathlib import Path
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient
D = Path(tempfile.mkdtemp()) / "db.json"
@override_settings(ERP_DB_PATH=D)
class Core(SimpleTestCase):
    def setUp(self):
        from django.conf import settings
        shutil.copy(settings.ERP_SEED_PATH, D); self.c = APIClient()
    def login(self, who):
        t = self.c.post("/api/auth/login", {"email": f"{who}@nexus.test", "password": "Demo#1234"}, format="json").data["data"]["token"]
        self.c.credentials(HTTP_AUTHORIZATION="Bearer " + t)
    def test_auth_required(self): self.assertEqual(self.c.get("/api/customers").status_code, 401)
    def test_role_forbidden(self):
        self.login("hr"); self.assertEqual(self.c.get("/api/invoices").status_code, 403)
    def test_no_overpay_no_double_confirm(self):
        self.login("admin")
        inv = self.c.get("/api/invoices?limit=100").data["data"][-1]
        self.assertEqual(self.c.post(f"/api/invoices/{inv['id']}/pay", {"amount": inv["total"] + 1}, format="json").status_code, 409)
        self.assertEqual(self.c.post(f"/api/salesOrders/{inv['salesOrderId']}/confirm", {}, format="json").status_code, 409)
