"""Quick verification that all tables and pgvector extension exist."""
import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as session:
        # Check pgvector extension
        r = await session.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector'"))
        ext = r.scalar_one_or_none()
        print(f"{'✅' if ext else '❌'} pgvector extension: {'INSTALLED' if ext else 'NOT FOUND'}")
        
        # Check tables
        r = await session.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """))
        tables = [row[0] for row in r.fetchall()]
        print(f"✅ Database tables: {tables}")
        
        # Check context_documents has vector column
        r = await session.execute(text("""
            SELECT column_name, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'context_documents'
            ORDER BY ordinal_position
        """))
        cols = [(row[0], row[1]) for row in r.fetchall()]
        print(f"✅ context_documents columns:")
        for name, dtype in cols:
            marker = "🔵 VECTOR" if dtype == "vector" else dtype
            print(f"   - {name}: {marker}")
        
        # Check personas table
        r = await session.execute(text("SELECT count(*) FROM personas"))
        count = r.scalar()
        print(f"✅ Personas in DB: {count}")

asyncio.run(check())
