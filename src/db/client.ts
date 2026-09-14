import {drizzle} from "drizzle-orm/d1"
import type {RouterContextProvider} from "react-router"

import {cloudflareContext} from "~/context"
import * as schema from "~/db/schema"

export const getDatabaseFromEnv = (env: Env) => {
    return drizzle(env.DB, {schema})
}

export const getDatabaseFromContext = (
    context: Readonly<RouterContextProvider>,
) => {
    return getDatabaseFromEnv(context.get(cloudflareContext).env)
}

export type Database = ReturnType<typeof getDatabaseFromEnv>
