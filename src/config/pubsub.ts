import { Link, Vote } from "@prisma/client";
import { PubSub } from "graphql-subscriptions";
import { TypedPubSub } from "typed-graphql-subscriptions";

export type PubSubChannels = {
  newLink: [{ createdLink: Link }];
  newVote: [{ createdVote: Vote }];
};

const pubSub = new TypedPubSub<PubSubChannels>(new PubSub());

export default pubSub;
