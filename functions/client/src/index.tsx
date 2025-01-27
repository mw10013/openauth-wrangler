import type { FC } from 'hono/jsx'
import { Client, createClient } from '@openauthjs/openauth/client'
import { subjects } from '@repo/shared/subjects'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { jsxRenderer, useRequestContext } from 'hono/jsx-renderer'

type HonoEnv = {
	Variables: {
		client: Client
		redirectUri: string
	}
}

const Messages: FC<{ messages: string[] }> = (props) => {
	return (
		<div className="prose lg:prose-xl dark:prose-invert container p-6">
			<h1>Hello Hono!</h1>
			<ul>
				{props.messages.map((message) => {
					return <li>{message}</li>
				})}
			</ul>
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
			await next()
		})
		app.get(
			'/*',
			jsxRenderer(({ children }) => {
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
									<a className="btn">Button</a>
								</div>
							</div>
							{children}
						</body>
					</html>
				)
			}),
		)
		app.get('/', (c) => {
			const cookies = getCookie(c)
			console.log({ cookies })
			const messages = ['Good Morning', 'Good Evening', 'Good Night']
			return c.render(<Messages messages={messages} />)
		})
		app.get('/public', (c) =>
			c.render(
				<div className="p-6">
					<CookiesCard />
				</div>,
			),
		)
		app.get('/protected', (c) => c.render(<div>Protected</div>))
		app.get('/play', (c) =>
			c.render(
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
						<a className="btn">Button</a>
					</div>
				</div>,
			),
		)
		app.get('/card', (c) => {
			return c.render(
				<div className="card-border card bg-base-100 w-96">
					<div className="card-body">
						<h2 className="card-title">Card Title</h2>
						<p>A card component has a figure, a body part, and inside body there are title and actions parts</p>
						<div className="card-actions justify-end">
							<button className="btn btn-primary">Buy Now</button>
						</div>
					</div>
				</div>,
			)
		})
		app.get('/callback', async (c) => {
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
		app.get('/authorize', async (c) => Response.redirect(await c.var.client.authorize(c.var.redirectUri, 'code').then((v) => v.url), 302))

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
