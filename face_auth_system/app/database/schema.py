from sqlalchemy import text


def ensure_schema(engine):
    # This project currently uses `create_all`, so existing tables won't be altered.
    # We add missing columns safely for Postgres so the app can evolve without Alembic.
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
                """
            )
        ).fetchall()
        cols = {r[0] for r in rows}

        # Add columns used by the OTP + auth flow.
        if "username" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN username VARCHAR(100)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON public.users (username)"))

        if "age" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN age INTEGER"))

        if "designation" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN designation VARCHAR(100)"))

        if "is_otp_verified" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN is_otp_verified BOOLEAN DEFAULT FALSE"))
