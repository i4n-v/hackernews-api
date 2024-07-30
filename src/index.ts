import "graphql-import-node";
import "dotenv/config";
import fastify from "fastify";
import router from "./router";

async function initServer() {
  const server = fastify();
  router(server);

  server.listen(
    {
      port: Number(process.env.API_PORT),
    },
    (error, address) => {
      if (error) {
        console.log(error);
      } else {
        console.log(`Server is running on ${address} 🔥`);
      }
    }
  );
}

initServer();
