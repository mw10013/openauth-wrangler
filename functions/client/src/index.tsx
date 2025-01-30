import type { FC, PropsWithChildren } from 'hono/jsx'
import { Client, createClient, VerifyResult } from '@openauthjs/openauth/client'
import { subjects } from '@repo/shared/subjects'
import { Context, Hono } from 'hono'
import { deleteCookie, getCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { jsxRenderer, useRequestContext } from 'hono/jsx-renderer'

type HonoEnv = {
	Bindings: Env
	Variables: {
		client: Client
		redirectUri: string
		verifyResult?: VerifyResult<typeof subjects>
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const app = new Hono<HonoEnv>()
		app.use(async (c, next) => {
			const client = createClient({
				clientID: 'client',
				issuer: c.env.OPENAUTH_ISSUER,
				fetch: (input, init) => c.env.WORKER.fetch(input, init),
			})
			c.set('client', client)
			c.set('redirectUri', new URL(c.req.url).origin + '/callback')
			const { accessToken, refreshToken } = await getTokenCookies(c)
			if (accessToken && refreshToken) {
				const verified = await client.verify(subjects, accessToken, {
					refresh: refreshToken,
					fetch: (input, init) => c.env.WORKER.fetch(input, init),
				})
				if (verified.err) {
					deleteTokenCookies(c)
				} else {
					c.set('verifyResult', verified)
				}
			}
			await next()
			if (c.var.verifyResult?.tokens) {
				await setTokenCookies(c, c.var.verifyResult.tokens.access, c.var.verifyResult.tokens.refresh)
			}
		})
		app.use('/protected/*', async (c, next) => {
			if (!c.var.verifyResult) {
				return c.redirect('/authorize')
			}
			await next()
		})
		app.use(
			'/*',
			jsxRenderer(({ children }) => <Layout>{children}</Layout>),
		)

		app.get('/', (c) => c.render(<Home />))
		app.get('/public', (c) => c.render('Public'))
		app.get('/protected', (c) => c.render('Protected'))
		app.get('/authorize', async (c) => {
			if (c.var.verifyResult) {
				return c.redirect('/')
			}
			const { url } = await c.var.client.authorize(c.var.redirectUri, 'code')
			return c.redirect(url)
		})
		app.post('/signout', (c) => {
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
				await setTokenCookies(c, exchanged.tokens.access, exchanged.tokens.refresh)
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
	const ListItems = () => (
		<>
			<li>
				<a href="/public">Public</a>
			</li>
			<li>
				<a href="/protected">Protected</a>
			</li>
		</>
	)
	return (
		<html>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link href="/tailwind.css" rel="stylesheet" />
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
								<ListItems />
							</ul>
						</div>
						<a href="/" className="btn btn-ghost text-xl">
							OpenAUTH Client
						</a>
					</div>
					<div className="navbar-center hidden lg:flex">
						<ul className="menu menu-horizontal px-1">
							<ListItems />
						</ul>
					</div>
					<div className="navbar-end">
						{ctx.var.verifyResult ? (
							<form action="/signout" method="post">
								<button type="submit" className="btn">
									Sign Out
								</button>
							</form>
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

const Home: FC = () => (
	<div className="flex gap-2">
		<VerifyResultCard />
		<CookiesCard />
	</div>
)

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

async function getTokenCookies(c: Context<HonoEnv>) {
	return {
		accessToken: await getSignedCookie(c, c.env.COOKIE_SECRET, 'accessToken'),
		refreshToken: await getSignedCookie(c, c.env.COOKIE_SECRET, 'refreshToken'),
	}
}

async function setTokenCookies(c: Context<HonoEnv>, accessToken: string, refreshToken: string) {
	const options = {
		path: '/',
		secure: true,
		httpOnly: true,
		maxAge: 60 * 5,
		sameSite: 'Strict',
	} as const
	await setSignedCookie(c, 'accessToken', accessToken, c.env.COOKIE_SECRET, options)
	await setSignedCookie(c, 'refreshToken', refreshToken, c.env.COOKIE_SECRET, options)
}

function deleteTokenCookies(c: Context<HonoEnv>) {
	const options = {
		secure: true,
	}
	deleteCookie(c, 'accessToken', options)
	deleteCookie(c, 'refreshToken', options)
}
