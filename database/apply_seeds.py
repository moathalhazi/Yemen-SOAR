import asyncio
import asyncpg
import os

# Database Config (Hardcoded for simplicity in this script based on .env)
DB_CONFIG = {
    "user": "soar_user",
    "password": "SecurePostgresPassword123!456",
    "database": "soar_db",
    "host": "localhost",
    "port": 5432
}

async def apply_seeds():
    print(f"Connecting to database at {DB_CONFIG['host']}:{DB_CONFIG['port']}...")
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        print("Connected successfully.")
        
        # Read the SQL file
        seed_file = "database/schemas/003_user_seeds.sql"
        print(f"Reading seed file: {seed_file}")
        with open(seed_file, "r") as f:
            sql_content = f.read()
            
        print("Executing SQL scripts...")
        await conn.execute(sql_content)
        print("[OK] RBAC Seeds applied successfully!")
        
        await conn.close()
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")

if __name__ == "__main__":
    asyncio.run(apply_seeds())
