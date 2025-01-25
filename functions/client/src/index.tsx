import type { FC } from 'hono/jsx'
import { Hono } from 'hono'
import { jsxRenderer, useRequestContext } from 'hono/jsx-renderer'

const Messages: FC<{ messages: string[] }> = (props) => {
	return (
		<div className="container prose p-6 lg:prose-xl dark:prose-invert">
			<h1>Hello Hono!</h1>
			<ul>
				{props.messages.map((message) => {
					return <li>{message}</li>
				})}
			</ul>
		</div>
	)
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const app = new Hono()
		app.get(
			'/*',
			jsxRenderer(({ children }) => {
				return (
					<html>
						<head>
							<meta charset="UTF-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1.0" />
							<link href="./tailwind.css" rel="stylesheet" />
							<title>Hono</title>
						</head>
						<body>{children}</body>
					</html>
				)
			}),
		)
		app.get('/', (c) => {
			const messages = ['Good Morning', 'Good Evening', 'Good Night']
			return c.render(<Messages messages={messages} />)
		})
		app.get('/card', (c) => {
			return c.render(
				<div className="card-border card w-96 bg-base-100">
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

		return app.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
