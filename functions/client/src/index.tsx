import type { FC, PropsWithChildren } from 'hono/jsx'
import { Client, createClient, VerifyResult } from '@openauthjs/openauth/client'
import { subjects } from '@repo/shared/subjects'
import { Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { jsxRenderer, useRequestContext } from 'hono/jsx-renderer'

type HonoEnv = {
	Variables: {
		cfEnv: Env
		client: Client
		redirectUri: string
		verifyResult?: VerifyResult<typeof subjects>
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const app = new Hono<HonoEnv>()
		app.use(async (c, next) => {
			c.set('cfEnv', env)
			const client = createClient({
				clientID: 'client',
				issuer: env.OPENAUTH_ISSUER,
				fetch: (input, init) => env.WORKER.fetch(input, init),
			})
			c.set('client', client)
			c.set('redirectUri', new URL(c.req.url).origin + '/callback')
			const { accessToken, refreshToken } = getCookie(c)
			if (accessToken && refreshToken) {
				const verified = await client.verify(subjects, accessToken, {
					refresh: refreshToken,
					fetch: (input, init) => env.WORKER.fetch(input, init),
				})
				if (verified.err) {
					deleteTokenCookies(c)
				} else {
					c.set('verifyResult', verified)
				}
			}
			await next()
			if (c.var.verifyResult?.tokens) {
				setTokenCookies(c, c.var.verifyResult.tokens.access, c.var.verifyResult.tokens.refresh)
			}
		})
		app.use('/protected/*', async (c, next) => {
			if (!c.var.verifyResult) {
				return c.redirect('/authorize')
			}
			await next()
		})
		app.get(
			'/*',
			jsxRenderer(({ children }) => <Layout>{children}</Layout>),
		)
		app.get('/', (c) => c.render(<VerifyResultCard />))
		app.get('/public', (c) => c.render(<CookiesCard />))
		app.get('/protected', (c) => c.render('Protected'))
		app.get('/authorize', async (c) => {
			if (c.var.verifyResult) {
				return c.redirect('/')
			}
			const { url } = await c.var.client.authorize(c.var.redirectUri, 'code')
			return c.redirect(url)
		})
		app.get('/signout', (c) => {
			c.set('verifyResult', undefined)
			deleteTokenCookies(c)
			return c.redirect('/')
		})
		app.get('/callback', async (c) => {
			try {
				c.set('verifyResult', undefined)
				const code = c.req.query('code')
				if (!code) throw new Error('Missing code')
				const exchanged = await c.var.client.exchange(code, c.var.redirectUri)
				if (exchanged.err) throw exchanged.err
				setTokenCookies(c, exchanged.tokens.access, exchanged.tokens.refresh)
				return c.redirect('/')
			} catch (e: any) {
				return new Response(e.toString())
			}
		})
		return app.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>

const Layout: FC<PropsWithChildren<{}>> = ({ children }) => {
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
						{ctx.var.verifyResult ? (
							<a href="/signout" className="btn">
								Sign Out
							</a>
						) : (
							<a href="/authorize" className="btn">
								Sign In / Up
							</a>
						)}
					</div>
				</div>
				<div className="p-6">{children}</div>
			</body>
		</html>
	)
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

function setTokenCookies(c: Context<HonoEnv>, accessToken: string, refreshToken: string) {
	const options = {
		path: '/',
		secure: c.var.cfEnv.ENVIRONMENT != 'local',
		httpOnly: true,
		maxAge: 60 * 5,
		sameSite: 'Strict',
	} as const
	setCookie(c, 'accessToken', accessToken, options)
	setCookie(c, 'refreshToken', refreshToken, options)
}

function deleteTokenCookies(c: Context<HonoEnv>) {
	deleteCookie(c, 'accessToken')
	deleteCookie(c, 'refreshToken')
}
