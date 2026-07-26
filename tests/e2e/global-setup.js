import { startServer } from "../../scripts/serve.mjs";

export default async function globalSetup() {
  const server = await startServer();

  return async () => {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  };
}
