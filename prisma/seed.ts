import { hashPassword } from "../src/utils/password";
import { seedAdminSchema } from "../src/validators/auth.validator";
import { userRepository } from "../src/repositories/user.repository";
import { prisma } from "../src/prisma/client";
import { ZodError } from "zod";

async function main() {
  const admin = seedAdminSchema.parse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  });

  const passwordHash = await hashPassword(admin.password);

  const user = await userRepository.upsertAdmin({
    name: admin.name,
    email: admin.email,
    passwordHash
  });

  console.log(`Admin user ready: ${user.email}`);
}

main()
  .catch((error) => {
    if (error instanceof ZodError) {
      console.error(
        "Invalid admin seed environment variables. Check ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD."
      );
    } else {
      console.error(error instanceof Error ? error.message : "Failed to seed admin user.");
    }

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
