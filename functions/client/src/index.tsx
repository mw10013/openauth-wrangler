import type { FC } from 'hono/jsx'
import { Client, createClient, VerifyResult } from '@openauthjs/openauth/client'
import { subjects } from '@repo/shared/subjects'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { jsxRenderer, useRequestContext } from 'hono/jsx-renderer'

type HonoEnv = {
	Variables: {
		client: Client
		redirectUri: string
		verifyResult?: VerifyResult<typeof subjects>
	}
}

const VerifyResultCard: FC = () => {
	const ctx = useRequestContext<HonoEnv>()
	const verifyResult = ctx.get('verifyResult')
	return (
		<div className="card bg-base-100 w-96 shadow-sm">
			<div className="card-body">
				<h2 className="card-title">Verify Result</h2>
				<pre>{JSON.stringify(verifyResult, null, 2)}</pre>
			</div>
		</div>
	)
}

const CookiesCard: FC = () => {
	const ctx = useRequestContext<HonoEnv>()
	const cookies = getCookie(ctx)
	return (
		<div className="card bg-base-100 w-96 shadow-sm">
			<div className="card-body">
				<h2 className="card-title">Cookies</h2>
				<ul className="space-y-2 overflow-auto">
					{Object.entries(cookies).map(([key, value]) => {
						return (
							<li>
								{key}: {value}
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const app = new Hono<HonoEnv>()
		app.use(async (c, next) => {
			const client = createClient({
				clientID: 'client',
				fetch: (input, init) => env.WORKER.fetch(input, init),
				issuer: env.OPENAUTH_ISSUER,
			})
			c.set('client', client)
			c.set('redirectUri', new URL(c.req.url).origin + '/callback')
			const { access_token, refresh_token } = getCookie(c)
			console.log({ access_token, refresh_token })
			if (access_token && refresh_token) {
				const verified = await client.verify(subjects, access_token, {
					refresh: refresh_token,
					fetch: (input, init) => env.WORKER.fetch(input, init),
				})
				if (!verified.err) {
					c.set('verifyResult', verified)
				}
			}
			await next()
			if (c.var.verifyResult?.tokens) {
				console.log({ log: 'Saving tokens', verifyResult: c.var.verifyResult })
				setSession(c.res, c.var.verifyResult.tokens.access, c.var.verifyResult.tokens.refresh)
			}
		})
		app.get(
			'/*',
			jsxRenderer(({ children }) => {
				const ctx = useRequestContext<HonoEnv>()
				return (
					<html>
						<head>
							<meta charset="UTF-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1.0" />
							<link href="./tailwind.css" rel="stylesheet" />
							<title>OpenAUTH Client</title>
						</head>
						<body>
							<div className="navbar bg-base-100 shadow-sm">
								<div className="navbar-start">
									<div className="dropdown">
										<div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
											</svg>
										</div>
										<ul tabIndex={0} class="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow">
											<li>
												<a href="/public">Public</a>
											</li>
											<li>
												<a href="/protected">Protected</a>
											</li>
										</ul>
									</div>
									<a href="/" className="btn btn-ghost text-xl">
										OpenAUTH Client
									</a>
								</div>
								<div className="navbar-center hidden lg:flex">
									<ul className="menu menu-horizontal px-1">
										<li>
											<a href="/public">Public</a>
										</li>
										<li>
											<a href="/protected">Protected</a>
										</li>
									</ul>
								</div>
								<div className="navbar-end">
									{ctx.var.verifyResult ? 'Sign Out' : 'Sign In / Up'}
									<a className="btn">Button</a>
								</div>
							</div>
							<div className="p-6">{children}</div>
						</body>
					</html>
				)
			}),
		)
		app.get('/', (c) => c.render(<VerifyResultCard />))
		app.get('/public', (c) => c.render(<CookiesCard />))
		app.get('/protected', (c) => c.render('Protected'))
		app.get('/authorize', async (c) => Response.redirect(await c.var.client.authorize(c.var.redirectUri, 'code').then((v) => v.url), 302))
		app.get('/callback', async (c) => {
			try {
				c.set('verifyResult', undefined)
				const url = new URL(c.req.url)
				const code = url.searchParams.get('code')!
				// The redirectUri is the original redirectUri you passed in during authorization and is used for verification
				const exchanged = await c.var.client.exchange(code, c.var.redirectUri)
				if (exchanged.err) throw new Error('Invalid code')
				const response = new Response(null, { status: 302, headers: {} })
				response.headers.set('Location', `${url.origin}/fe`)
				setSession(response, exchanged.tokens.access, exchanged.tokens.refresh)
				return response
			} catch (e: any) {
				return new Response(e.toString())
			}
		})

		const fe = new Hono<{
			Variables: {
				client: Client
				redirectUri: string
			}
		}>().basePath('/fe')
		fe.use(async (c, next) => {
			const client = createClient({
				clientID: 'client',
				fetch: (input, init) => env.WORKER.fetch(input, init),
				issuer: env.OPENAUTH_ISSUER,
			})
			c.set('client', client)
			c.set('redirectUri', new URL(c.req.url).origin + '/fe/callback')
			await next()
		})
		fe.get('/callback', async (c) => {
			try {
				const url = new URL(c.req.url)
				const code = url.searchParams.get('code')!
				// The redirectUri is the original redirectUri you passed in during authorization and is used for verification
				const exchanged = await c.var.client.exchange(code, c.var.redirectUri)
				if (exchanged.err) throw new Error('Invalid code')
				const response = new Response(null, { status: 302, headers: {} })
				response.headers.set('Location', `${url.origin}/fe`)
				setSession(response, exchanged.tokens.access, exchanged.tokens.refresh)
				return response
			} catch (e: any) {
				return new Response(e.toString())
			}
		})
		fe.get('/authorize', async (c) => Response.redirect(await c.var.client.authorize(c.var.redirectUri, 'code').then((v) => v.url), 302))
		fe.get('/', async (c) => {
			const cookies = new URLSearchParams(request.headers.get('cookie')?.replaceAll('; ', '&'))
			const verified = await c.var.client.verify(subjects, cookies.get('access_token')!, {
				refresh: cookies.get('refresh_token') || undefined,
				fetch: (input, init) => env.WORKER.fetch(input, init),
			})
			if (verified.err) return Response.redirect(`${new URL(c.req.url).origin}/fe/authorize`, 302)
			const response = Response.json(verified.subject)
			if (verified.tokens) setSession(response, verified.tokens.access, verified.tokens.refresh)
			return response
		})
		app.route('/', fe)
		return app.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>

// https://github.com/openauthjs/openauth/blob/master/examples/client/cloudflare-api/api.ts
function setSession(response: Response, access: string, refresh: string) {
	if (access) {
		response.headers.append('Set-Cookie', `access_token=${access}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2147483647`)
	}
	if (refresh) {
		response.headers.append('Set-Cookie', `refresh_token=${refresh}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2147483647`)
	}
}
