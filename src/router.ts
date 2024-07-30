import { FastifyInstance } from "fastify";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendResult,
  shouldRenderGraphiQL,
} from "graphql-helix";
import schema from "./schema/schema";
import contextFactory from "./config/context";

export default function routes(server: FastifyInstance) {
  server.get("/", (request, response) => {
    response.send({ active: true, message: "Hackernews API" });
  });

  server.get("/graphql", (request, response) => {
    if (shouldRenderGraphiQL(request)) {
      response.header("Content-Type", "text/html");
      response.send(
        renderGraphiQL({
          endpoint: "/graphql",
        })
      );
    }
  });

  server.post("/graphql", async (request, response) => {
    const { operationName, query, variables } = getGraphQLParameters(request);

    const result = await processRequest({
      request,
      schema,
      operationName,
      contextFactory: () => contextFactory(request),
      query,
      variables,
    });

    sendResult(result, response.raw);
  });
}
