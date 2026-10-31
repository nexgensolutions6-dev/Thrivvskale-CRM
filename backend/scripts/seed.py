"""Create the first owner account. With --demo, also add sample reps and leads.

    python -m scripts.seed
    python -m scripts.seed --demo
"""

import argparse
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app import models  # noqa: F401
from app.config import get_settings
from app.constants import CLOSED_STAGES, DEFAULT_SOURCES, STAGES
from app.database import Base, SessionLocal, engine
from app.models import Lead, User
from app.security import hash_password
from app.services.leads import phone_key

DEMO_REPS = ["Arjun Mehta", "Neha Singh", "Imran Khan"]
DEMO_PASSWORD = "demo-password"

FIRST_NAMES = ["Aarav", "Divya", "Karan", "Pooja", "Rohit", "Sana", "Tarun", "Usha", "Varun", "Zoya"]
LAST_NAMES = ["Agarwal", "Bose", "Chopra", "Desai", "Gupta", "Hegde", "Joshi", "Nair", "Reddy", "Shah"]
BUSINESSES = ["Traders", "Interiors", "Builders", "Clinic", "Steels", "Foods", "Logistics", "Textiles"]


def today_at(hour: int, minute: int = 0, days: int = 0) -> datetime:
    tz = ZoneInfo(get_settings().app_timezone)
    local = datetime.now(tz).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return (local + timedelta(days=days)).astimezone(timezone.utc)


def ensure_user(db, name: str, email: str, password: str, role: str) -> User:
    user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if user is None:
        user = User(name=name, email=email.lower(), password_hash=hash_password(password), role=role)
        db.add(user)
        db.flush()
        print(f"Created {role}: {email}")
    return user


def demo_leads(reps: dict[str, int]) -> list[Lead]:
    arjun, neha, imran = (reps[name] for name in DEMO_REPS)
    samples = [
        ("Anil Sharma", "Sharma Steels", "98201 44310", "anil@sharmasteels.in", "IndiaMART", True, "hot", "proposal_sent", arjun, today_at(10, 30)),
        ("Priya Menon", "Menon Interiors", "99870 22145", "priya@menoninteriors.com", "Meta", True, "warm", "contacted", neha, today_at(12)),
        ("Rahul Jain", "RJ Traders", "90040 11876", "rahul@rjtraders.in", "Google", True, "hot", "meeting_scheduled", arjun, today_at(15)),
        ("Meera Iyer", "Iyer Clinic", "98450 66721", "meera@iyerclinic.in", "WhatsApp", True, "hot", "new", imran, today_at(11, days=1)),
        ("Vikram Patel", "Patel Fabrication", "97230 88104", "vikram@patelfab.com", "IndiaMART", False, "cold", "new", neha, None),
        ("Sneha Kulkarni", None, "98810 54092", "sneha.k@gmail.com", "Website form", True, "cold", "contacted", imran, today_at(10, days=-2)),
        ("Farhan Qureshi", "FQ Builders", "99200 31477", "farhan@fqbuilders.in", "Referral", True, "warm", "proposal_sent", arjun, today_at(11, days=5)),
        ("Kiran Rao", "Rao Coaching", "96110 72305", "kiran@raocoaching.in", "Meta", False, "cold", "lost", neha, None),
    ]
    leads = [
        Lead(name=n, company=c, phone=p, phone_key=phone_key(p), email=e, source=s, qualified=q,
             temperature=t, stage=st, assigned_to_id=a, next_follow_up=f)
        for n, c, p, e, s, q, t, st, a, f in samples
    ]

    rng = random.Random(7)
    for i in range(52):
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        phone = f"9{rng.randint(1000, 9999)} {rng.randint(10000, 99999)}"
        stage = rng.choice(STAGES)
        follow_up = None
        if stage not in CLOSED_STAGES and rng.random() > 0.2:
            follow_up = today_at(rng.randint(10, 17), days=rng.randint(-3, 14))
        leads.append(Lead(
            name=f"{first} {last}",
            company=f"{last} {rng.choice(BUSINESSES)}" if rng.random() > 0.15 else None,
            phone=phone,
            phone_key=phone_key(phone),
            email=f"{first}.{last}{i}@example.com".lower(),
            source=rng.choice(DEFAULT_SOURCES),
            qualified=rng.choice([True, True, False, None]),
            temperature=rng.choice(["hot", "warm", "cold"]),
            stage=stage,
            assigned_to_id=rng.choice([arjun, neha, imran]),
            next_follow_up=follow_up,
        ))
    return leads


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true", help="add sample reps and leads")
    args = parser.parse_args()

    settings = get_settings()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        ensure_user(db, settings.seed_owner_name, settings.seed_owner_email, settings.seed_owner_password, "owner")
        if args.demo:
            reps = {
                name: ensure_user(
                    db, name, f"{name.split()[0].lower()}@example.com", DEMO_PASSWORD, "rep"
                ).id
                for name in DEMO_REPS
            }
            if db.scalar(select(func.count()).select_from(Lead)):
                print("Leads already exist, skipping demo leads")
            else:
                leads = demo_leads(reps)
                db.add_all(leads)
                print(f"Added {len(leads)} demo leads")
        db.commit()


if __name__ == "__main__":
    main()
