"""Builds seed.json (+ db.json) deterministically through the real services, so references and stock are consistent."""
import os, sys, json, shutil, random, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django; django.setup()
from django.conf import settings
from django.contrib.auth.hashers import make_password
from erp import services as S
from erp.repositories import transaction, read
random.seed(7)
U = lambda n: str(uuid.uuid5(uuid.NAMESPACE_DNS, "nexuserp/" + n))
settings.ERP_DB_PATH = ROOT / "data" / "db.json"
cols = "users employees departments attendance leaveRequests customers leads suppliers categories products inventoryTransactions salesOrders purchaseOrders invoices payments expenses notifications activityLogs".split()
settings.ERP_DB_PATH.write_text(json.dumps({**{c: [] for c in cols}, "settings": {"companyName": "NexusERP", "currency": "PHP", "dateFormat": "MMM dd, yyyy"}}))
PW = "Demo#1234"  # development-only demo password
dep = ["Executive", "HR", "Finance", "Sales", "Warehouse"]
first = ["Ana", "Ben", "Carla", "Dino", "Ella", "Felix", "Gina", "Hugo", "Iris", "Jon"]
cat = ["Electronics", "Office", "Furniture", "Packaging", "Tools"]
with transaction() as db:
    db["departments"] = [{"id": U("d" + n), "name": n, "createdAt": "2026-01-01"} for n in dep]
    db["employees"] = [{"id": U(f"e{i}"), "name": f"{n} Reyes", "email": f"{n.lower()}@nexus.test", "departmentId": U("d" + dep[i % 5]), "position": "Staff", "salary": 25000 + i * 2000, "hireDate": "2024-03-01"} for i, n in enumerate(first)]
    for r in ["Admin", "HR", "Finance", "Sales", "Inventory"]:
        db["users"].append({"id": U("u" + r), "email": f"{r.lower()}@nexus.test", "role": r, "active": True, "passwordHash": make_password(PW)})
    db["customers"] = [{"id": U(f"c{i}"), "name": f"Customer {i+1} Corp", "email": f"c{i+1}@client.test", "phone": f"0917000{i:04d}"} for i in range(15)]
    db["suppliers"] = [{"id": U(f"s{i}"), "name": f"Supplier {i+1} Trading"} for i in range(8)]
    db["categories"] = [{"id": U("k" + n), "name": n} for n in cat]
    db["products"] = [{"id": U(f"p{i}"), "sku": f"SKU-{i+1:03d}", "name": f"Product {i+1}", "categoryId": U("k" + cat[i % 5]), "price": 100 + i * 25, "cost": 60 + i * 15, "stock": 0, "reorderLevel": 10} for i in range(20)]
    db["leads"] = [{"id": U(f"l{i}"), "name": f"Lead {i+1}", "stage": st, "assignedTo": U("e3"), "followUp": "2026-11-15"} for i, st in enumerate(["new", "contacted", "qualified", "proposal", "won", "lost"])]
    db["attendance"] = [{"id": U(f"a{i}"), "employeeId": U(f"e{i % 10}"), "date": f"2026-10-{1 + i // 10:02d}", "status": "present"} for i in range(20)]
    db["leaveRequests"] = [{"id": U(f"lv{i}"), "employeeId": U(f"e{i}"), "startDate": "2026-11-10", "endDate": "2026-11-12", "status": "pending", "createdAt": "2026-10-20"} for i in range(10)]
    db["expenses"] = [{"id": U(f"x{i}"), "description": f"Expense {i+1}", "amount": 500 + i * 150, "date": f"2026-{8 + i % 3:02d}-{5 + i:02d}"} for i in range(20)]
    db["notifications"] = [{"id": U(f"n{i}"), "message": m, "read": False} for i, m in enumerate(["Welcome to NexusERP", "Review pending approvals"])]
for i in range(10):
    po = S.create("seed", "purchaseOrders", {"supplierId": U(f"s{i % 8}"), "items": [{"productId": U(f"p{(i*2) % 20}"), "qty": 100}, {"productId": U(f"p{(i*2+1) % 20}"), "qty": 100}]})
    if i < 7: S.run_action("seed", "purchaseOrders", po["id"], "approve", {})
    if i < 5: S.run_action("seed", "purchaseOrders", po["id"], "receive", {"items": [{"productId": l["productId"], "qty": 100 if i % 2 else 50} for l in po["items"]]})
S.run_action("seed", "products", U("p3"), "stock", {"type": "in", "qty": 8, "note": "opening"})
oids = [S.create("seed", "salesOrders", {"customerId": U(f"c{i}"), "items": [{"productId": U(f"p{(i * 2) % 10}"), "qty": random.randint(1, 5), "discount": 5}]})["id"] for i in range(15)]
for oid in oids[:10]: S.run_action("seed", "salesOrders", oid, "confirm", {})
for n, inv in enumerate(read()["invoices"][:6]): S.run_action("seed", "invoices", inv["id"], "pay", {"amount": inv["balance"] if n % 2 else round(inv["balance"] / 2, 2)})
shutil.copy(settings.ERP_DB_PATH, ROOT / "data" / "seed.json"); print("seed.json and db.json written. Demo password:", PW)
