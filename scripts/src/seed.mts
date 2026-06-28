import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  const adminEmail = "admin@provision.co.za";
  const hash = await bcrypt.hash("admin123", 10);

  await db.insert(usersTable)
    .values({
      name: "Admin User",
      email: adminEmail,
      passwordHash: hash,
      role: "admin",
      phone: "+27 11 000 0000",
    })
    .onConflictDoUpdate({
      target: usersTable.email,
      set: { passwordHash: hash, role: "admin" },
    });

  console.log("✓ Admin seeded: admin@provision.co.za / admin123");

  await db.insert(usersTable)
    .values({
      name: "John Supervisor",
      email: "supervisor@provision.co.za",
      passwordHash: await bcrypt.hash("super123", 10),
      role: "supervisor",
      phone: "+27 82 111 2222",
    })
    .onConflictDoUpdate({
      target: usersTable.email,
      set: { role: "supervisor" },
    });

  console.log("✓ Supervisor seeded: supervisor@provision.co.za / super123");

  await db.insert(usersTable)
    .values({
      name: "Mike Worker",
      email: "worker@provision.co.za",
      passwordHash: await bcrypt.hash("work123", 10),
      role: "worker",
      phone: "+27 73 333 4444",
    })
    .onConflictDoUpdate({
      target: usersTable.email,
      set: { role: "worker" },
    });

  console.log("✓ Worker seeded: worker@provision.co.za / work123");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
