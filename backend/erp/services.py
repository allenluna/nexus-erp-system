from datetime import date, datetime, timedelta, timezone
from django.contrib.auth.hashers import make_password
from rest_framework.exceptions import NotFound, ValidationError
from core.exceptions import Conflict
from .repositories import transaction, new_id

def now(): return datetime.now(timezone.utc).isoformat(timespec="seconds")
def r2(x): return round(float(x) + 1e-9, 2)
def find(db, col, id):
    r = next((x for x in db[col] if x["id"] == id), None)
    if not r: raise NotFound(f"{col} record not found.")
    return r
def ref(db, col, id, field):
    if not any(x["id"] == id for x in db[col]): raise ValidationError({field: f"Unknown {col} reference."})
def log(db, actor, action, target): db["activityLogs"].append({"id": new_id(), "at": now(), "user": actor, "action": action, "ref": target})

SCHEMA = {  # collection -> (required fields, {field: referenced collection})
 "departments": (["name"], {}), "categories": (["name"], {}),
 "employees": (["name", "email", "departmentId"], {"departmentId": "departments"}),
 "attendance": (["employeeId", "date"], {"employeeId": "employees"}),
 "leaveRequests": (["employeeId", "startDate", "endDate"], {"employeeId": "employees"}),
 "customers": (["name", "email"], {}), "suppliers": (["name"], {}),
 "leads": (["name", "stage"], {"assignedTo": "employees"}),
 "products": (["sku", "name", "categoryId", "price", "cost"], {"categoryId": "categories"}),
 "salesOrders": (["customerId", "items"], {"customerId": "customers"}),
 "purchaseOrders": (["supplierId", "items"], {"supplierId": "suppliers"}),
 "expenses": (["description", "amount", "date"], {}),
 "users": (["email", "role", "password"], {}),
}
ORDERS = {"salesOrders": "sales", "purchaseOrders": "purchase"}
PROTECTED = {"id", "createdAt", "stock", "paid", "balance", "status", "subtotal", "tax", "total", "passwordHash"}
LEAD_STAGES = {"new", "contacted", "qualified", "proposal", "won", "lost"}

def validate(db, col, data, partial=False):
    req, refs = SCHEMA[col]
    errs = {f: "This field is required." for f in req if not partial and data.get(f) in (None, "", [])}
    if errs: raise ValidationError(errs)
    for f, c in refs.items():
        if data.get(f): ref(db, c, data[f], f)
    for f in ("price", "cost", "amount"):
        if f in data:
            try:
                if float(data[f]) < 0: raise ValueError
            except (TypeError, ValueError): raise ValidationError({f: "Must be a non-negative number."})
    if col == "leads" and "stage" in data and data["stage"] not in LEAD_STAGES:
        raise ValidationError({"stage": f"Must be one of {sorted(LEAD_STAGES)}."})

def price_order(db, data, kind):
    items = data.get("items")
    if not isinstance(items, list) or not items: raise ValidationError({"items": "At least one line item is required."})
    sub, out = 0, []
    for i in items:
        ref(db, "products", i.get("productId"), "items")
        p = find(db, "products", i["productId"])
        try:
            qty = int(i.get("qty", 0)); price = float(i.get("price", p["price"] if kind == "sales" else p["cost"])); disc = float(i.get("discount", 0))
        except (TypeError, ValueError): raise ValidationError({"items": "Invalid number in line item."})
        if qty <= 0 or price < 0 or not 0 <= disc <= 100: raise ValidationError({"items": "Invalid qty, price or discount."})
        line = r2(qty * price * (1 - disc / 100)); sub += line
        out.append({"productId": p["id"], "qty": qty, "price": price, "discount": disc, "lineTotal": line, "received": 0})
    tax = r2(sub * float(data.get("taxRate", 12)) / 100)
    data.update(items=out, subtotal=r2(sub), tax=tax, total=r2(sub + tax))

def create(actor, col, data):
    data = {k: v for k, v in data.items() if k not in PROTECTED}
    with transaction() as db:
        validate(db, col, data)
        if col == "users":
            if data["role"] not in {"Admin", "HR", "Finance", "Sales", "Inventory"}: raise ValidationError({"role": "Invalid role."})
            data["passwordHash"] = make_password(data.pop("password")); data["active"] = True
        if col in ORDERS:
            price_order(db, data, ORDERS[col]); data["status"] = "draft"
        if col == "products": data["stock"] = 0
        if col == "leaveRequests": data["status"] = "pending"
        data.update(id=new_id(), createdAt=now()); db[col].append(data)
        log(db, actor, f"created {col}", data["id"])
    return data

def update(actor, col, id, data):
    data = {k: v for k, v in data.items() if k not in PROTECTED}
    with transaction() as db:
        rec = find(db, col, id)
        if col in ORDERS and rec["status"] != "draft": raise Conflict("Only draft orders can be edited.")
        merged = {**rec, **data}
        validate(db, col, merged, partial=True)
        if col in ORDERS: price_order(db, merged, ORDERS[col])
        rec.update(merged); log(db, actor, f"updated {col}", id)
    return rec

def delete(actor, col, id):
    with transaction() as db:
        rec = find(db, col, id)
        if col in ORDERS and rec["status"] != "draft": raise Conflict("Only draft orders can be deleted.")
        if col == "products" and rec["stock"] != 0: raise Conflict("Cannot delete a product with stock.")
        db[col].remove(rec); log(db, actor, f"deleted {col}", id)

def move(db, pid, delta, kind, source, actor, note=""):
    p = find(db, "products", pid)
    if p["stock"] + delta < 0: raise Conflict(f"Insufficient stock for {p['name']}.")
    p["stock"] += delta
    db["inventoryTransactions"].append({"id": new_id(), "productId": pid, "type": kind, "qty": delta, "source": source, "note": note, "at": now(), "by": actor})

def a_stock(db, p, body, actor):
    try: q = int(body.get("qty"))
    except (TypeError, ValueError): raise ValidationError({"qty": "Integer required."})
    t = body.get("type")
    if t not in ("in", "out", "adjust") or q == 0 or (t != "adjust" and q < 0): raise ValidationError({"type": "type in|out|adjust with valid qty."})
    move(db, p["id"], -q if t == "out" else q, t, "manual", actor, body.get("note", ""))

def a_confirm(db, o, body, actor):
    if o["status"] != "draft": raise Conflict("Only draft orders can be confirmed.")
    for i in o["items"]: move(db, i["productId"], -i["qty"], "stock-out", o["id"], actor)
    o["status"] = "confirmed"; today = date.today()
    db["invoices"].append({"id": new_id(), "number": f"INV-{len(db['invoices']) + 1:04d}", "salesOrderId": o["id"], "customerId": o["customerId"],
        "total": o["total"], "paid": 0.0, "balance": o["total"], "status": "unpaid", "issueDate": today.isoformat(), "dueDate": (today + timedelta(days=30)).isoformat(), "createdAt": now()})
def a_cancel_sale(db, o, body, actor):
    if o["status"] not in ("draft", "confirmed"): raise Conflict("Order cannot be cancelled.")
    if o["status"] == "confirmed":
        inv = next(i for i in db["invoices"] if i["salesOrderId"] == o["id"])
        if inv["paid"] > 0: raise Conflict("Order has payments; cannot cancel.")
        for i in o["items"]: move(db, i["productId"], i["qty"], "stock-in", o["id"], actor, "order cancelled")
        inv["status"] = "cancelled"; inv["balance"] = 0.0
    o["status"] = "cancelled"

def a_approve_po(db, o, body, actor):
    if o["status"] != "draft": raise Conflict("Only draft POs can be approved.")
    o["status"] = "approved"
def a_receive(db, o, body, actor):
    if o["status"] not in ("approved", "partial"): raise Conflict("PO must be approved before receiving.")
    recv = body.get("items")
    if not isinstance(recv, list) or not recv: raise ValidationError({"items": "Required."})
    for r in recv:
        line = next((l for l in o["items"] if l["productId"] == r.get("productId")), None)
        try: q = int(r.get("qty"))
        except (TypeError, ValueError): q = 0
        if not line or q <= 0: raise ValidationError({"items": "Invalid line."})
        if q > line["qty"] - line["received"]: raise Conflict("Receiving more than ordered.")
        line["received"] += q; move(db, line["productId"], q, "stock-in", o["id"], actor, "PO receipt")
    o["status"] = "received" if all(l["received"] == l["qty"] for l in o["items"]) else "partial"
def a_cancel_po(db, o, body, actor):
    if o["status"] not in ("draft", "approved"): raise Conflict("Received POs cannot be cancelled.")
    o["status"] = "cancelled"

def a_pay(db, inv, body, actor):
    try: amt = r2(body.get("amount"))
    except (TypeError, ValueError): raise ValidationError({"amount": "Number required."})
    if amt <= 0: raise ValidationError({"amount": "Must be positive."})
    if inv["status"] == "cancelled": raise Conflict("Cannot pay a cancelled invoice.")
    if amt > inv["balance"] + 1e-9: raise Conflict("Payment exceeds outstanding balance.")
    inv["paid"] = r2(inv["paid"] + amt); inv["balance"] = r2(inv["total"] - inv["paid"])
    inv["status"] = "paid" if inv["balance"] == 0 else "partial"
    db["payments"].append({"id": new_id(), "invoiceId": inv["id"], "amount": amt, "method": body.get("method", "cash"), "date": date.today().isoformat(), "createdAt": now()})
def _leave(to):
    def f(db, l, body, actor):
        if l["status"] != "pending": raise Conflict("Only pending requests can be decided.")
        l["status"] = to
    return f
ACTIONS = {("products", "stock"): a_stock, ("salesOrders", "confirm"): a_confirm, ("salesOrders", "cancel"): a_cancel_sale,
 ("purchaseOrders", "approve"): a_approve_po, ("purchaseOrders", "receive"): a_receive, ("purchaseOrders", "cancel"): a_cancel_po,
 ("invoices", "pay"): a_pay, ("leaveRequests", "approve"): _leave("approved"), ("leaveRequests", "reject"): _leave("rejected")}
def run_action(actor, col, id, action, body):
    fn = ACTIONS.get((col, action))
    if not fn: raise NotFound("Unknown action.")
    with transaction() as db:
        rec = find(db, col, id); fn(db, rec, body or {}, actor); log(db, actor, f"{action} {col}", id)
    return rec

def summary(db):
    live = [i for i in db["invoices"] if i["status"] != "cancelled"]
    invoiced = r2(sum(i["total"] for i in live)); collected = r2(sum(p["amount"] for p in db["payments"]))
    exp = r2(sum(float(e["amount"]) for e in db["expenses"])); today = date.today().isoformat()
    low = [p for p in db["products"] if p["stock"] <= p.get("reorderLevel", 10)]
    overdue = [i for i in live if i["balance"] > 0 and i["dueDate"] < today]
    months = {}
    for p in db["payments"]: months.setdefault(p["date"][:7], [0, 0])[0] += p["amount"]
    for e in db["expenses"]: months.setdefault(e["date"][:7], [0, 0])[1] += float(e["amount"])
    return {"invoiced": invoiced, "collected": collected, "expenses": exp, "netProfit": r2(collected - exp),
        "receivables": r2(sum(i["balance"] for i in live)), "employees": len(db["employees"]), "customers": len(db["customers"]),
        "lowStockCount": len(low), "lowStock": [{"id": p["id"], "name": p["name"], "stock": p["stock"]} for p in low],
        "overdueInvoices": len(overdue), "pendingApprovals": sum(1 for l in db["leaveRequests"] if l["status"] == "pending") + sum(1 for o in db["purchaseOrders"] if o["status"] == "draft"),
        "monthly": [{"month": m, "revenue": r2(v[0]), "expenses": r2(v[1])} for m, v in sorted(months.items())],
        "recentActivity": db["activityLogs"][-8:][::-1]}
