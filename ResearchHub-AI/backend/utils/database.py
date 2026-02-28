from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/researchhub")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,   # recycle connections every 30 min
    pool_pre_ping=True,  # verify connection liveness before checkout
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    """Yield a database session; commits on success, rolls back on error.
    The `async with` context manager handles closing automatically."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables defined in SQLAlchemy models."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # --- Lightweight migrations for new columns ---
    async with engine.begin() as conn:
        from sqlalchemy import text, inspect as sa_inspect

        def _check_column(sync_conn):
            inspector = sa_inspect(sync_conn)
            columns = [c["name"] for c in inspector.get_columns("conversations")]
            return "is_web_search" in columns

        try:
            has_col = await conn.run_sync(_check_column)
            if not has_col:
                await conn.execute(
                    text("ALTER TABLE conversations ADD COLUMN is_web_search BOOLEAN NOT NULL DEFAULT FALSE")
                )
                print("[MIGRATION] Added 'is_web_search' column to conversations table")
        except Exception as e:
            # Table may not exist yet (first run) — create_all above handles that
            print(f"[MIGRATION] Skipped is_web_search migration: {e}")
