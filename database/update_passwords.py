"""Update user passwords with correct bcrypt hash"""
import asyncio
import asyncpg

async def update_passwords():
    conn = await asyncpg.connect(
        user='soar_user',
        password='SecurePostgresPassword123!456',
        database='soar_db',
        host='localhost',
        port=5432
    )
    
    # New bcrypt hash for 'Admin123!'
    new_hash = '$2b$12$ceWl.kvWs/lIkl98gKG0DeoidhnN8AWJ8f243EuAD6nwWk6wJynRG'
    
    result = await conn.execute("UPDATE users SET password_hash = $1", new_hash)
    print(f"Updated passwords: {result}")
    
    # Verify update
    rows = await conn.fetch("SELECT username, password_hash FROM users LIMIT 3")
    for row in rows:
        print(f"  {row['username']}: {row['password_hash'][:30]}...")
    
    await conn.close()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(update_passwords())
