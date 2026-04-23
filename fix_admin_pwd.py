import asyncio
import asyncpg
import bcrypt

async def main():
    conn = await asyncpg.connect('postgresql://soar_user:ChangeMe123!@postgres:5432/soar_db')
    
    # Hash the password explicitly just to be sure
    pwd = '775635255'
    hashed = bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    await conn.execute("UPDATE users SET password_hash = $1 WHERE username = 'admin_user'", hashed)
    await conn.close()
    print("Database password updated successfully.")

if __name__ == "__main__":
    asyncio.run(main())
