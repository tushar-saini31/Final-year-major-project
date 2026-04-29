from sqlalchemy import text


def ensure_schema(engine):
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as conn:
        # ── users table columns ───────────────────────────────────────────────
        rows = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'users'"
            )
        ).fetchall()
        cols = {r[0] for r in rows}

        if "username" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN username VARCHAR(100)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON public.users (username)"))

        if "age" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN age INTEGER"))

        if "designation" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN designation VARCHAR(100)"))

        if "is_otp_verified" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN is_otp_verified BOOLEAN DEFAULT FALSE"))

        # ── IDS columns (NEW) ─────────────────────────────────────────────────
        if "is_locked" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN is_locked BOOLEAN DEFAULT FALSE"))

        if "blocked_until" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN blocked_until TIMESTAMP"))

        if "failed_attempts" not in cols:
            conn.execute(text("ALTER TABLE public.users ADD COLUMN failed_attempts INTEGER DEFAULT 0"))

        # ── IDS tables (created by create_all, but guard here too) ───────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.login_attempts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(100),
                device_id VARCHAR(255),
                device_name VARCHAR(255),
                user_agent TEXT,
                ip_address VARCHAR(60),
                timestamp TIMESTAMP DEFAULT NOW(),
                success BOOLEAN DEFAULT FALSE,
                step_failed VARCHAR(20),
                risk_score INTEGER DEFAULT 0,
                risk_level VARCHAR(10) DEFAULT 'low',
                alert_type VARCHAR(50)
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.trusted_devices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(100),
                device_id VARCHAR(255),
                device_name VARCHAR(255),
                user_agent TEXT,
                first_seen TIMESTAMP DEFAULT NOW(),
                last_seen TIMESTAMP DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.intrusion_alerts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(100),
                device_id VARCHAR(255),
                ip_address VARCHAR(60),
                alert_type VARCHAR(50),
                risk_score INTEGER DEFAULT 0,
                description TEXT,
                timestamp TIMESTAMP DEFAULT NOW(),
                resolved BOOLEAN DEFAULT FALSE
            )
        """))