import { PrismaClient, User } from "@prisma/client";
import prisma from "./prisma";
import { JwtPayload, verify } from "jsonwebtoken";
import { FastifyRequest } from "fastify";
import pubSub from "./pubsub";

export type GraphQLContext = {
  prisma: PrismaClient;
  pubSub: typeof pubSub;
  user: User | null;
  verifyAuth(): void | never;
};

async function authenticateUser(request: FastifyRequest): Promise<User | null> {
  if (request?.headers?.authorization) {
    const token = request.headers.authorization.split(" ")[1];
    const { userId } = verify(token, process.env.API_SECRET as string) as JwtPayload;

    return await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
  }

  return null;
}

export default async function contextFactory(request: FastifyRequest): Promise<GraphQLContext> {
  const user = await authenticateUser(request);

  function verifyAuth() {
    if (user === null) {
      throw new Error("Unauthenticated!");
    }
  }

  return {
    prisma,
    pubSub,
    user,
    verifyAuth,
  };
}
