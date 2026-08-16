const { PrismaClient } = require("@prisma/client");

// מופע יחיד של Prisma לכל האפליקציה
const prisma = new PrismaClient();

module.exports = prisma;
