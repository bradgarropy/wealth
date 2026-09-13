import type {WorkflowEvent, WorkflowStep} from "cloudflare:workers"
import {WorkflowEntrypoint} from "cloudflare:workers"

type Environment = {
    ACCOUNT_ID: string
    BUCKET: R2Bucket
    DATABASE_ID: string
    D1_TOKEN: string
}

type Result = {
    at_bookmark?: string
    error?: string
    result?: {
        filename?: string
        signed_url?: string
    }
    status?: "complete" | "error"
    success?: boolean
}

type Response<T> = {
    errors?: Array<{message?: string}>
    result?: T
    success: boolean
}

const callExport = async (
    environment: Environment,
    body: Record<string, string>,
) => {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${environment.ACCOUNT_ID}/d1/database/${environment.DATABASE_ID}/export`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${environment.D1_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        },
    )

    const json = (await response.json()) as Response<Result>

    if (!response.ok || !json.success || !json.result) {
        const message = json.errors?.[0]?.message ?? response.statusText
        throw new Error(`Export request failed: ${message}`)
    }

    return json.result
}

const startExport = (environment: Environment) => {
    return callExport(environment, {output_format: "polling"})
}

const pollExport = (environment: Environment, bookmark: string) => {
    return callExport(environment, {
        current_bookmark: bookmark,
        output_format: "polling",
    })
}

const createKey = (timestamp: Date) => {
    const formattedTimestamp = timestamp.toISOString().replaceAll(":", "-")
    return `wealth-${formattedTimestamp}.sql`
}

export class BackupWorkflow extends WorkflowEntrypoint<Environment> {
    async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
        const bookmark = await step.do("Start export", async () => {
            const result = await startExport(this.env)

            if (!result.at_bookmark) {
                throw new Error("Export did not return a bookmark")
            }

            return result.at_bookmark
        })

        const backup = await step.do("Wait for export", async () => {
            const result = await pollExport(this.env, bookmark)

            if (result.status === "error") {
                throw new Error(`Export failed: ${result.error}`)
            }

            if (
                result.status !== "complete" ||
                !result.result?.filename ||
                !result.result.signed_url
            ) {
                throw new Error("Export is not ready")
            }

            return {
                filename: result.result.filename,
                signedUrl: result.result.signed_url,
            }
        })

        const key = createKey(event.timestamp)

        const storedBackup = await step.do("Store export", async () => {
            const response = await fetch(backup.signedUrl)

            if (!response.ok || !response.body) {
                throw new Error("Export download failed")
            }

            const object = await this.env.BUCKET.put(key, response.body, {
                customMetadata: {
                    bookmark,
                    sourceFilename: backup.filename,
                },
                httpMetadata: {
                    contentType: "application/sql",
                },
            })

            return {
                key: object.key,
                size: object.size,
            }
        })

        console.info("Backup stored", {
            bookmark,
            ...storedBackup,
        })

        return storedBackup
    }
}
