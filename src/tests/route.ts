import {RouterContextProvider} from "react-router"

import {cloudflareContext} from "~/context"

export const createRouteArguments = (request: Request) => {
    const context = new RouterContextProvider()
    const url = new URL(request.url)

    context.set(cloudflareContext, {
        ctx: {} as ExecutionContext,
        env: {} as Env,
    })

    return {
        context,
        pattern: url.pathname,
        request,
        url,
    }
}
