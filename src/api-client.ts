import type { AppType } from "./routes/api/$.ts"
import { hc } from "hono/client"

let client: ReturnType<typeof hc<AppType>> | null = null

export function getClient() {
  if (typeof window === "undefined") {
    // throw new Error("getClient() called on the server")
  }
  if (!client) {
    client = hc<AppType>(
      typeof window !== `undefined` ? window?.location.origin : ``,
      {
        init: {
          credentials: `include`,
        },
      }
    )
  }
  return client
}
