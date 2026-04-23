"""Grant all permissions to soar_admin role"""
import asyncio
import asyncpg

async def grant_admin_all_permissions():
    conn = await asyncpg.connect(
        user='soar_user',
        password='SecurePostgresPassword123!456',
        database='soar_db',
        host='localhost',
        port=5432
    )
    
    # First, check current permissions for admin
    print("Current admin permissions:")
    rows = await conn.fetch("""
        SELECT r.name as role, p.resource, p.action 
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name = 'soar_admin'
    """)
    print(f"  Found {len(rows)} permissions")
    
    # Grant ALL permissions to soar_admin
    result = await conn.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id 
        FROM roles r, permissions p
        WHERE r.name = 'soar_admin'
        ON CONFLICT DO NOTHING
    """)
    print(f"Granted all permissions: {result}")
    
    # Verify new count
    new_rows = await conn.fetch("""
        SELECT r.name as role, p.resource, p.action 
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name = 'soar_admin'
    """)
    print(f"After update: {len(new_rows)} permissions")
    for row in new_rows[:10]:
        print(f"  - {row['resource']}:{row['action']}")
    
    # Also check user's roles structure
    print("\nChecking admin_user roles:")
    user_roles = await conn.fetch("""
        SELECT u.username, r.name as role_name
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.username = 'admin_user'
    """)
    for row in user_roles:
        print(f"  {row['username']} -> {row['role_name']}")
    
    await conn.close()
    print("\nDone!")

if __name__ == "__main__":
    asyncio.run(grant_admin_all_permissions())
