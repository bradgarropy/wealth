import {PlusIcon} from "lucide-react"
import {useState} from "react"
import {data} from "react-router"
import {useFetcher} from "react-router"

import {AccountDialog} from "~/components/AccountDialog"
import {AccountList} from "~/components/AccountList"
import {DeleteAccountDialog} from "~/components/DeleteAccountDialog"
import {Button} from "~/components/ui/button"
import {getDatabaseFromContext} from "~/db/client"
import type {Account} from "~/db/queries"
import {
    archiveAccount,
    createAccount,
    deleteAccount,
    getAccounts,
    unarchiveAccount,
    updateAccount,
} from "~/db/queries"
import {accountActionSchema} from "~/schemas/account"

import type {Route} from "./+types/accounts"

export const action = async ({context, request}: Route.ActionArgs) => {
    const formData = await request.formData()
    const result = accountActionSchema.safeParse(Object.fromEntries(formData))

    if (!result.success) {
        return data(
            {error: "Check the account details and try again."},
            {status: 400},
        )
    }

    const db = getDatabaseFromContext(context)

    try {
        switch (result.data.intent) {
            case "create": {
                const {category, name, type} = result.data
                await createAccount(db, {category, name, type})
                break
            }
            case "update": {
                const {category, id, name, type} = result.data
                await updateAccount(db, id, {category, name, type})
                break
            }
            case "archive":
                await archiveAccount(db, result.data.id)
                break
            case "unarchive":
                await unarchiveAccount(db, result.data.id)
                break
            case "delete": {
                const deleted = await deleteAccount(db, result.data.id)

                if (!deleted) {
                    return data(
                        {
                            error: "Accounts with balance history cannot be deleted. Archive this account instead.",
                        },
                        {status: 409},
                    )
                }

                break
            }
        }
    } catch {
        return data(
            {
                error: "Unable to save the account. Account names must be unique.",
            },
            {status: 409},
        )
    }

    return {ok: true}
}

export const loader = async ({context}: Route.LoaderArgs) => {
    return {accounts: await getAccounts(getDatabaseFromContext(context))}
}

const Route = ({loaderData}: Route.ComponentProps) => {
    const archiveFetcher = useFetcher<{error?: string; ok?: boolean}>()
    const [accountDialogOpen, setAccountDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
    const activeAccounts = loaderData.accounts.filter(
        account => !account.archived,
    )
    const archivedAccounts = loaderData.accounts.filter(
        account => account.archived,
    )

    const handleNew = () => {
        setEditingAccount(null)
        setAccountDialogOpen(true)
    }

    const handleEdit = (account: Account) => {
        setEditingAccount(account)
        setAccountDialogOpen(true)
    }

    const handleArchive = (account: Account) => {
        void archiveFetcher.submit(
            {
                id: String(account.id),
                intent: account.archived ? "unarchive" : "archive",
            },
            {method: "post"},
        )
    }

    const handleDelete = (account: Account) => {
        setDeletingAccount(account)
        setDeleteDialogOpen(true)
    }

    return (
        <>
            <title>wealth | accounts</title>

            <main className="mx-auto w-full max-w-3xl py-8 sm:py-16">
                <div className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold">Accounts</h1>
                        <p className="text-muted-foreground">
                            Accounts included in balance captures and financial
                            calculations.
                        </p>
                    </div>

                    <Button variant="outline" onClick={handleNew}>
                        <PlusIcon />
                        New account
                    </Button>
                </div>

                <div className="space-y-12">
                    <AccountList
                        accounts={activeAccounts}
                        emptyMessage="No active accounts."
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        title="Active"
                    />
                    <AccountList
                        accounts={archivedAccounts}
                        emptyMessage="No archived accounts."
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        title="Archived"
                    />
                </div>

                {archiveFetcher.data?.error ? (
                    <p role="alert" className="mt-6 text-sm text-destructive">
                        {archiveFetcher.data.error}
                    </p>
                ) : null}
            </main>

            <AccountDialog
                key={editingAccount?.id ?? "new"}
                account={editingAccount}
                open={accountDialogOpen}
                onOpenChange={setAccountDialogOpen}
            />
            <DeleteAccountDialog
                key={deletingAccount?.id ?? "delete"}
                account={deletingAccount}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    )
}

export default Route
