import type { FC } from "hono/jsx";
import { Hono } from "hono";
import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import { Client, createClient } from "@openauthjs/openauth/client";
import { subjects } from "@repo/shared/subjects";

const Messages: FC<{ messages: string[] }> = (props) => {
  return (
    <div className="container prose p-6 lg:prose-xl dark:prose-invert">
      <h1>Hello Hono!</h1>
      <ul>
        {props.messages.map((message) => {
          return <li>{message}</li>;
        })}
      </ul>
    </div>
  );
};

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const app = new Hono();
    app.get(
      "/*",
      jsxRenderer(({ children }) => {
        return (
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              />
              <link href="./tailwind.css" rel="stylesheet" />
              <title>Hono</title>
            </head>
            <body>{children}</body>
          </html>
        );
      })
    );
    app.get("/", (c) => {
      const messages = ["Good Morning", "Good Evening", "Good Night"];
      return c.render(<Messages messages={messages} />);
    });
    app.get("/card", (c) => {
      return c.render(
        <div className="card-border card w-96 bg-base-100">
          <div className="card-body">
            <h2 className="card-title">Card Title</h2>
            <p>
              A card component has a figure, a body part, and inside body there
              are title and actions parts
            </p>
            <div className="card-actions justify-end">
              <button className="btn btn-primary">Buy Now</button>
            </div>
          </div>
        </div>
      );
    });

    const fe = new Hono<{
      Variables: {
        client: Client;
        redirectUri: string;
      };
    }>().basePath("/fe");
    fe.use(async (c, next) => {
      const client = createClient({
        clientID: "client",
        fetch: (input, init) => env.WORKER.fetch(input, init),
        issuer: env.OPENAUTH_ISSUER,
      });
      c.set("client", client);
      c.set("redirectUri", new URL(c.req.url).origin + "/fe/callback");
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
    app.route("/", fe);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

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
