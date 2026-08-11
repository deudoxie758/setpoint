import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../src/db/prisma";

afterAll(async () => {
  await prisma.$disconnect();
});
