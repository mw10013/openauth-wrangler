import { issuer } from '@openauthjs/openauth'
import { CodeProvider } from '@openauthjs/openauth/provider/code'
import { PasswordProvider } from '@openauthjs/openauth/provider/password'
import { CloudflareStorage } from '@openauthjs/openauth/storage/cloudflare'
import { CodeUI } from '@openauthjs/openauth/ui/code'
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
				code: CodeProvider(
					CodeUI({
						copy: {
							code_placeholder: 'Code (check Worker logs)',
						},
						sendCode: async (claims, code) => console.log(claims.email, code),
					}),
				),
				password: PasswordProvider(
					PasswordUI({
						sendCode: async (email, code) => {
							console.log(email, code)
						},
						copy: {
							input_code: 'Code (check Worker logs)',
						},
					}),
				),
			},
			success: async (ctx, value) => {
				if (value.provider === 'code') {
					return ctx.subject('user', {
						userId: value.claims.email,
					})
				}
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
