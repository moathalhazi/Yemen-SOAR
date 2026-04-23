import asyncio
import asyncpg
import os

# Database Config
DB_CONFIG = {
    "user": "soar_user",
    "password": "ChangeMe123!",
    "database": "soar_db",
    "host": "localhost",
    "port": 5432
}

async def apply_migration():
    print(f"Connecting to database at {DB_CONFIG['host']}:{DB_CONFIG['port']}...")
    try:
        conn = await asyncpg.connect(**DB_CONFIG)
        print("Connected successfully.")
        
        # Read the SQL file
        # Assuming run from project root
        migration_file = "database/schemas/007_reports.sql"
        if not os.path.exists(migration_file):
            # Try relative to script
            migration_file = os.path.join(os.path.dirname(__file__), "schemas", "007_reports.sql")
            
        print(f"Reading migration file: {migration_file}")
        with open(migration_file, "r") as f:
            sql_content = f.read()
            
        print("Executing SQL scripts...")
        await conn.execute(sql_content)
        print("[OK] Reports table created successfully!")
        
        await conn.close()
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")

if __name__ == "__main__":
    asyncio.run(apply_migration())
