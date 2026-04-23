import asyncio
import asyncpg
import os

async def clear_evidence():
    conn = await asyncpg.connect(
        user=os.getenv("POSTGRES_USER", "soar_user"),
        password=os.getenv("POSTGRES_PASSWORD", "soar_pass"),
        database=os.getenv("POSTGRES_DB", "soar_db"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432")
    )
    
    print("Connected. Deleting chain...")
    await conn.execute("DELETE FROM chain_of_custody")
    print("Deleting evidence...")
    await conn.execute("ALTER TABLE chain_of_custody DISABLE TRIGGER ALL;")
    await conn.execute("DELETE FROM evidence")
    await conn.execute("ALTER TABLE chain_of_custody ENABLE TRIGGER ALL;")
    print("Done.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(clear_evidence())
import asyncpg
import os
import uuid
import random
from datetime import datetime, timedelta

async def seed_evidence():
    conn = await asyncpg.connect(
        user=os.getenv("POSTGRES_USER", "soar_user"),
        password=os.getenv("POSTGRES_PASSWORD", "soar_pass"),
        database=os.getenv("POSTGRES_DB", "soar_db"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432")
    )
    
    print("Connected to DB.")
    
    # Check if there are incidents
    incidents = await conn.fetch("SELECT id FROM incidents LIMIT 5")
    if not incidents:
        # Create a dummy incident if none exist just to link evidence
        inc_id = await conn.fetchval(
            "INSERT INTO incidents (title, severity, description, detected_at) VALUES ($1, $2, $3, $4) RETURNING id",
            "Malware Outbreak Detection", "critical", "Ransomware detected across multiple workstations.", datetime.now()
        )
        incidents = [{"id": inc_id}]
    
    admin_id = await conn.fetchval("SELECT id FROM users WHERE username = 'admin'")
    
    evidence_types = ['memory_dump', 'disk_image', 'network_capture', 'logs', 'file']
    status_options = ['collected', 'analyzing', 'analyzed', 'archived']
    
    for i in range(10):
        inc_id = incidents[random.randint(0, len(incidents)-1)]["id"]
        ev_type = random.choice(evidence_types)
        filename = f"capture_{ev_type}_{i}.cap" if ev_type == 'network_capture' else f"dump_{i}.bin"
        
        ev_id = await conn.fetchval(
            """
            INSERT INTO evidence 
            (incident_id, type, collected_from, collected_by, storage_path, file_name, file_size, sha256_hash, status, collected_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
            """,
            inc_id,
            ev_type,
            f"HOSTNAME-{random.randint(100, 999)}",
            admin_id,
            f"/storage/evidence/{filename}",
            filename,
            random.randint(1024, 1024000), # random size
            uuid.uuid4().hex * 2, # fake hash
            random.choice(status_options),
            datetime.now() - timedelta(days=random.randint(0, 5))
        )
        print(f"Inserted evidence {ev_id}")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(seed_evidence())
