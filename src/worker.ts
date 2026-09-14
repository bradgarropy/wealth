import * as Sentry from "@sentry/cloudflare"
import {createRequestHandler, RouterContextProvider} from "react-router"

import {cloudflareContext} from "./context"
export {BackupWorkflow} from "~/workflows/backup"

const requestHandler = createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE,
)

const handler = {
    fetch(request, env, ctx) {
        const context = new RouterContextProvider()
        context.set(cloudflareContext, {env, ctx})

        return requestHandler(request, context)
    },
} satisfies ExportedHandler<Env>

const sentryHandler = Sentry.withSentry(
    env => ({
        dsn: env.SENTRY_DSN,
        sendDefaultPii: true,
    }),
    handler,
)

export default sentryHandler
