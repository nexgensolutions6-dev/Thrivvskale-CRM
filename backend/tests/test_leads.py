import io
from datetime import datetime, timedelta, timezone

from openpyxl import Workbook, load_workbook


def make_lead(client, headers, **overrides):
    body = {"name": "Anil Sharma", "phone": "98201 44310", "email": "anil@sharmasteels.in"} | overrides
    res = client.post("/api/leads", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def xlsx(rows):
    workbook = Workbook()
    for row in rows:
        workbook.active.append(row)
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def upload(client, headers, content, filename="leads.xlsx"):
    return client.post("/api/leads/import", files={"file": (filename, content)}, headers=headers)


def test_requires_login(client):
    assert client.get("/api/leads").status_code == 401


def test_wrong_password_rejected(client):
    res = client.post("/api/auth/login", json={"email": "owner@test.in", "password": "nope"})
    assert res.status_code == 401


def test_create_assigns_creator_and_logs_activity(client, rep):
    lead = make_lead(client, rep)
    assert lead["assigned_to_name"] == "Arjun Mehta"
    detail = client.get(f"/api/leads/{lead['id']}", headers=rep).json()
    assert [a["body"] for a in detail["activities"]] == ["Lead created"]


def test_lead_needs_phone_or_email(client, owner):
    res = client.post("/api/leads", json={"name": "No Contact"}, headers=owner)
    assert res.status_code == 422


def test_duplicate_phone_ignores_formatting(client, owner):
    make_lead(client, owner)
    res = client.post("/api/leads", json={"name": "Copy", "phone": "+91-9820144310"}, headers=owner)
    assert res.status_code == 409


def test_filters_and_search(client, owner):
    make_lead(client, owner, temperature="hot", source="Meta", qualified=True)
    make_lead(client, owner, name="Priya Menon", phone="9987022145", email="priya@menon.com",
              temperature="cold", source="Google", qualified=False)

    def names(**params):
        res = client.get("/api/leads", params=params, headers=owner).json()
        return [item["name"] for item in res["items"]]

    assert names(temperature="hot") == ["Anil Sharma"]
    assert names(source="Google") == ["Priya Menon"]
    assert names(qualified="false") == ["Priya Menon"]
    assert names(q="menon") == ["Priya Menon"]
    assert names(q="9820") == ["Anil Sharma"]
    assert names(q="100%") == []


def test_pagination_reports_total(client, owner):
    for i in range(3):
        make_lead(client, owner, name=f"Lead {i}", phone=f"900000000{i}", email=None)
    res = client.get("/api/leads", params={"page_size": 2, "page": 2}, headers=owner).json()
    assert res["total"] == 3
    assert len(res["items"]) == 1


def test_sort_by_assigned_keeps_unassigned_last(client, owner):
    make_lead(client, owner, name="Mine")
    make_lead(client, owner, name="Nobody", phone="9000000001", email=None, assigned_to_id=None)
    res = client.get("/api/leads", params={"sort": "assigned", "order": "asc"}, headers=owner).json()
    assert [item["name"] for item in res["items"]] == ["Mine", "Nobody"]


def test_moving_to_closed_stage_clears_follow_up(client, owner):
    follow_up = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    lead = make_lead(client, owner, next_follow_up=follow_up)
    res = client.patch(f"/api/leads/{lead['id']}", json={"stage": "lost"}, headers=owner).json()
    assert res["stage"] == "lost"
    assert res["next_follow_up"] is None
    detail = client.get(f"/api/leads/{lead['id']}", headers=owner).json()
    assert "Stage changed from New to Lost" in [a["body"] for a in detail["activities"]]


def test_closed_lead_keeps_no_follow_up_even_if_one_is_sent(client, owner):
    follow_up = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    lead = make_lead(client, owner)
    res = client.patch(
        f"/api/leads/{lead['id']}", json={"stage": "won", "next_follow_up": follow_up}, headers=owner
    ).json()
    assert res["next_follow_up"] is None
    res = client.patch(f"/api/leads/{lead['id']}", json={"next_follow_up": follow_up}, headers=owner).json()
    assert res["next_follow_up"] is None


def test_update_can_clear_nullable_fields(client, owner):
    lead = make_lead(client, owner, qualified=True, company="Sharma Steels")
    res = client.patch(
        f"/api/leads/{lead['id']}", json={"qualified": None, "company": ""}, headers=owner
    ).json()
    assert res["qualified"] is None
    assert res["company"] is None


def test_update_rejects_removing_last_contact(client, owner):
    lead = make_lead(client, owner, email=None)
    res = client.patch(f"/api/leads/{lead['id']}", json={"phone": ""}, headers=owner)
    assert res.status_code == 422


def test_rep_cannot_delete(client, owner, rep):
    lead = make_lead(client, owner)
    assert client.delete(f"/api/leads/{lead['id']}", headers=rep).status_code == 403
    assert client.delete(f"/api/leads/{lead['id']}", headers=owner).status_code == 204


def test_bulk_update_and_delete(client, owner):
    one = make_lead(client, owner)
    two = make_lead(client, owner, name="Two", phone="9000000002", email=None)
    ids = [one["id"], two["id"]]

    res = client.post("/api/leads/bulk", json={"ids": ids, "changes": {"assigned_to_id": None}}, headers=owner)
    assert res.json() == {"affected": 2}
    leads = client.get("/api/leads", headers=owner).json()["items"]
    assert all(lead["assigned_to_id"] is None for lead in leads)

    assert client.post("/api/leads/bulk-delete", json={"ids": ids}, headers=owner).json() == {"affected": 2}
    assert client.get("/api/leads", headers=owner).json()["total"] == 0


def test_reminders_skip_closed_and_future_leads(client, owner):
    now = datetime.now(timezone.utc)
    make_lead(client, owner, name="Due", next_follow_up=(now - timedelta(hours=1)).isoformat())
    make_lead(client, owner, name="Later", phone="9000000003", email=None,
              next_follow_up=(now + timedelta(days=3)).isoformat())
    res = client.get("/api/leads/reminders", params={"until": now.isoformat()}, headers=owner).json()
    assert [lead["name"] for lead in res] == ["Due"]


def test_import_maps_headers_and_reports_problems(client, owner):
    content = xlsx([
        ["Lead Name", "Mobile No", "E-mail", "Lead Source", "Temp", "Status", "Assigned To", "Follow Up", "Qualified"],
        ["Anil Sharma", 9820144310, "ANIL@steels.in", "IndiaMART", "Hot", "Proposal sent", "Arjun", "29/10/2026 10:30", "True lead"],
        ["Same Phone", "+91 98201 44310", None, None, None, None, None, None, None],
        ["No Contact", None, None, None, None, None, None, None, None],
        ["Bad Stage", 9000000009, None, None, None, "Negotiating", None, None, None],
        [None, None, None, None, None, None, None, None, None],
    ])
    res = upload(client, owner, content).json()
    assert (res["created"], res["duplicates"], res["failed"]) == (1, 1, 2)
    assert [e["row"] for e in res["errors"]] == [4, 5]

    lead = client.get("/api/leads", headers=owner).json()["items"][0]
    assert lead["phone"] == "9820144310"
    assert lead["email"] == "anil@steels.in"
    assert lead["stage"] == "proposal_sent"
    assert lead["assigned_to_name"] == "Arjun Mehta"
    assert lead["qualified"] is True
    assert lead["next_follow_up"].startswith("2026-10-29T05:00:00")  # 10:30 IST


def test_import_csv(client, owner):
    content = b"Name,Phone\nPriya Menon,9987022145\n"
    assert upload(client, owner, content, "leads.csv").json()["created"] == 1


def test_import_rejects_sheet_without_name_column(client, owner):
    res = upload(client, owner, xlsx([["Phone"], ["9820144310"]]))
    assert res.status_code == 400
    assert "Name" in res.json()["detail"]


def test_import_rejects_other_file_types(client, owner):
    assert upload(client, owner, b"hello", "leads.txt").status_code == 400


def test_export_applies_filters_and_round_trips(client, owner):
    make_lead(client, owner, temperature="hot", stage="proposal_sent", qualified=True)
    make_lead(client, owner, name="Priya", phone="9987022145", email=None, temperature="cold")

    res = client.get("/api/leads/export", params={"temperature": "hot"}, headers=owner)
    rows = list(load_workbook(io.BytesIO(res.content)).active.values)
    assert len(rows) == 2
    assert rows[1][0] == "Anil Sharma"

    client.post("/api/leads/bulk-delete", json={"ids": [
        lead["id"] for lead in client.get("/api/leads", headers=owner).json()["items"]
    ]}, headers=owner)
    result = upload(client, owner, res.content).json()
    assert (result["created"], result["failed"]) == (1, 0)
    lead = client.get("/api/leads", headers=owner).json()["items"][0]
    assert lead["stage"] == "proposal_sent"
    assert lead["temperature"] == "hot"
