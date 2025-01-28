import { issuer } from '@openauthjs/openauth'
import { PasswordProvider } from '@openauthjs/openauth/provider/password'
import { CloudflareStorage } from '@openauthjs/openauth/storage/cloudflare'
import { PasswordUI } from '@openauthjs/openauth/ui/password'
import { subjects } from '@repo/shared/subjects'

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return issuer({
			ttl: {
				access: 60 * 5,
				refresh: 60 * 15,
			},
			storage: CloudflareStorage({
				namespace: env.KV,
			}),
			subjects,
			providers: {
				password: PasswordProvider(
					PasswordUI({
						sendCode: async (email, code) => {
							console.log(email, code)
						},
					}),
				),
			},
			success: async (ctx, value) => {
				if (value.provider === 'password') {
					return ctx.subject('user', {
						userId: value.email,
					})
				}
				throw new Error('Invalid provider')
			},
		}).fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
