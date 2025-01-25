import { issuer } from "@openauthjs/openauth";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import {
  type ExecutionContext,
  type KVNamespace,
} from "@cloudflare/workers-types";
import { subjects } from "./subjects.js";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { Hono } from "hono";
import { Client, createClient } from "@openauthjs/openauth/client";

interface Env {
  KV: KVNamespace;
}

async function getUser(email: string) {
  // Get user from database
  // Return user ID
  return "123";
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const openauth = issuer({
      storage: CloudflareStorage({
        namespace: env.KV,
      }),
      subjects,
      providers: {
        password: PasswordProvider(
          PasswordUI({
            sendCode: async (email, code) => {
              console.log(email, code);
            },
          })
        ),
      },
      success: async (ctx, value) => {
        if (value.provider === "password") {
          return ctx.subject("user", {
            id: await getUser(value.email),
          });
        }
        throw new Error("Invalid provider");
      },
    });

    // Impossible to extend with additional routes:https://github.com/openauthjs/openauth/issues/127#issuecomment-2569976202
    // https://hono.dev/docs/api/routing#grouping
    const fe = new Hono<{
      Variables: {
        client: Client;
        redirectUri: string;
      };
    }>().basePath("/fe");
    fe.use(async (c, next) => {
      const { origin } = new URL(c.req.url);
      const client = createClient({
        clientID: "fe",
        fetch: async (input, init) => {
          const request = new Request(input, init);
          return openauth.fetch(request, env, ctx);
        },
        issuer: origin,
      });
      c.set("client", client);
      c.set("redirectUri", origin + "/fe/callback");
      await next();
    });

    fe.get("/callback", async (c) => {
      try {
        const url = new URL(c.req.url);
        const code = url.searchParams.get("code")!;
        const exchanged = await c.var.client.exchange(code, c.var.redirectUri);
        if (exchanged.err) throw new Error("Invalid code");
        const response = new Response(null, { status: 302, headers: {} });
        response.headers.set("Location", url.origin + "/fe");
        setSession(response, exchanged.tokens.access, exchanged.tokens.refresh);
        return response;
      } catch (e: any) {
        return new Response(e.toString());
      }
    });
    fe.get("/authorize", async (c) =>
      Response.redirect(
        await c.var.client
          .authorize(c.var.redirectUri, "code")
          .then((v) => v.url),
        302
      )
    );
    fe.get("/", async (c) => {
      const cookies = new URLSearchParams(
        request.headers.get("cookie")?.replaceAll("; ", "&")
      );
      const verified = await c.var.client.verify(
        subjects,
        cookies.get("access_token")!,
        {
          refresh: cookies.get("refresh_token") || undefined,
        }
      );
      if (verified.err)
        return Response.redirect(
          new URL(c.req.url).origin + "/fe/authorize",
          302
        );
      const response = Response.json(verified.subject);
      if (verified.tokens)
        setSession(response, verified.tokens.access, verified.tokens.refresh);
      return response;
    });

    const app = new Hono();
    app.route("/", fe);
    app.route("/", openauth); // Mount last
    return app.fetch(request, env, ctx);
  },
};

// https://github.com/openauthjs/openauth/blob/master/examples/client/cloudflare-api/api.ts
function setSession(response: Response, access: string, refresh: string) {
  if (access) {
    response.headers.append(
      "Set-Cookie",
      `access_token=${access}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2147483647`
    );
  }
  if (refresh) {
    response.headers.append(
      "Set-Cookie",
      `refresh_token=${refresh}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2147483647`
    );
  }
}
