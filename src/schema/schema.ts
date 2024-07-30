import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "./schema.graphql";
import { GraphQLContext } from "../config/context";
import { compare, hash } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { PubSubChannels } from "../config/pubsub";
import { Link, Prisma, User } from "@prisma/client";

interface IFeedArgs {
  filter?: string;
  skip?: number;
  take?: number;
  orderBy?: {
    description?: Prisma.SortOrder;
    url?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
  };
}

const resolvers = {
  Query: {
    info: () => `This is the API of a Hackernews Clone`,
    feed: async (parent: unknown, args: IFeedArgs, context: GraphQLContext) => {
      let where = {};

      if (args.filter) {
        where = {
          OR: [{ description: { contains: args.filter } }, { url: { contains: args.filter } }],
        };
      }

      const count = await context.prisma.link.count({ where });
      const links = await context.prisma.link.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy,
      });

      return {
        count,
        links,
      };
    },
    me: (parent: unknown, args: unknown, context: GraphQLContext) => {
      context.verifyAuth();
      return context.user;
    },
  },
  Mutation: {
    post: async (
      parent: unknown,
      args: Pick<Link, "url" | "description">,
      context: GraphQLContext
    ) => {
      context.verifyAuth();

      const link = await context.prisma.link.create({
        data: {
          ...args,
          postedBy: {
            connect: { id: context.user!.id },
          },
        },
      });

      await context.pubSub.publish("newLink", { createdLink: link });

      return link;
    },
    signup: async (parent: unknown, args: Omit<User, "id">, context: GraphQLContext) => {
      const password = await hash(args.password, 10);

      const user = await context.prisma.user.create({
        data: { ...args, password },
      });

      const token = sign({ userId: user.id }, process.env.API_SECRET as string);

      return {
        token,
        user,
      };
    },
    login: async (parent: unknown, args: Omit<User, "name" | "id">, context: GraphQLContext) => {
      const message = "E-mail or password is incorrect";

      const user = await context.prisma.user.findUnique({
        where: { email: args.email },
      });

      if (!user) {
        throw new Error(message);
      }

      const valid = await compare(args.password, user.password);

      if (!valid) {
        throw new Error(message);
      }

      const token = sign({ userId: user.id }, process.env.API_SECRET as string);

      return {
        token,
        user,
      };
    },
    vote: async (parent: unknown, args: { linkId: string }, context: GraphQLContext) => {
      context.verifyAuth();

      const userId = context.user!.id;

      const vote = await context.prisma.vote.findUnique({
        where: {
          linkId_userId: {
            linkId: Number(args.linkId),
            userId: userId,
          },
        },
      });

      if (vote !== null) {
        throw new Error(`Already voted for link: ${args.linkId}`);
      }

      const newVote = await context.prisma.vote.create({
        data: {
          user: { connect: { id: userId } },
          link: { connect: { id: Number(args.linkId) } },
        },
      });

      context.pubSub.publish("newVote", { createdVote: newVote });

      return newVote;
    },
  },
  Subscription: {
    newLink: {
      subscribe: (parent: unknown, args: unknown, context: GraphQLContext) => {
        return context.pubSub.asyncIterator("newLink");
      },
      resolve: (payload: PubSubChannels["newLink"][0]) => {},
    },
    newVote: {
      subscribe: (parent: unknown, args: unknown, context: GraphQLContext) => {
        return context.pubSub.asyncIterator("newVote");
      },
      resolve: (payload: PubSubChannels["newVote"][0]) => {
        return payload.createdVote;
      },
    },
  },
  Link: {
    postedBy: async (parent: Link, args: unknown, context: GraphQLContext) => {
      if (!parent.postedById) {
        return null;
      }

      return context.prisma.link.findUnique({ where: { id: parent.id } }).postedBy();
    },
    votes: (parent: Link, args: unknown, context: GraphQLContext) => {
      return context.prisma.link.findUnique({ where: { id: parent.id } }).votes();
    },
  },
  User: {
    links: (parent: User, args: unknown, context: GraphQLContext) =>
      context.prisma.user.findUnique({ where: { id: parent.id } }).links(),
  },
  Vote: {
    link: (parent: User, args: unknown, context: GraphQLContext) => {
      return context.prisma.vote.findUnique({ where: { id: parent.id } }).link();
    },
    user: (parent: User, args: unknown, context: GraphQLContext) => {
      return context.prisma.vote.findUnique({ where: { id: parent.id } }).user();
    },
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export default schema;
