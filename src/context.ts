import {createContext} from "react-router"

export type CloudflareContext = {
    ctx: ExecutionContext
    env: Env
}

export const cloudflareContext = createContext<CloudflareContext>()
