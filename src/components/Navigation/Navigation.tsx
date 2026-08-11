import {
    ChartNoAxesCombinedIcon,
    ChartSplineIcon,
    CirclePlusIcon,
    PlusIcon,
    SettingsIcon,
    WalletCardsIcon,
} from "lucide-react"
import {NavLink} from "react-router"

import {buttonVariants} from "~/components/ui/button"
import {cn} from "~/lib/utils"

const desktopLinkClassName = ({isActive}: {isActive: boolean}) =>
    cn(
        "border-b-2 border-transparent py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
        isActive && "border-foreground text-foreground",
    )

const mobileLinkClassName = ({isActive}: {isActive: boolean}) =>
    cn(
        "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors",
        isActive && "text-foreground",
    )

const Navigation = () => {
    return (
        <>
            <NavLink
                to="/settings"
                prefetch="intent"
                aria-label="Settings"
                title="Settings"
                className={({isActive}) =>
                    cn(
                        buttonVariants({variant: "ghost", size: "icon"}),
                        "sm:hidden",
                        isActive && "bg-muted",
                    )
                }
            >
                <SettingsIcon />
            </NavLink>

            <nav
                aria-label="Mobile navigation"
                className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
            >
                <div className="mx-auto flex max-w-md items-center">
                    <NavLink
                        to="/"
                        prefetch="intent"
                        className={mobileLinkClassName}
                    >
                        <ChartNoAxesCombinedIcon className="size-5" />
                        <span>Overview</span>
                    </NavLink>

                    <NavLink
                        to="/insights"
                        prefetch="intent"
                        className={mobileLinkClassName}
                    >
                        <ChartSplineIcon className="size-5" />
                        <span>Insights</span>
                    </NavLink>

                    <NavLink
                        to="/capture"
                        prefetch="intent"
                        className={mobileLinkClassName}
                    >
                        <CirclePlusIcon className="size-5" />
                        <span>Capture</span>
                    </NavLink>

                    <NavLink
                        to="/accounts"
                        prefetch="intent"
                        className={mobileLinkClassName}
                    >
                        <WalletCardsIcon className="size-5" />
                        <span>Accounts</span>
                    </NavLink>
                </div>
            </nav>

            <nav
                aria-label="Desktop navigation"
                className="hidden items-center gap-5 sm:flex"
            >
                <NavLink
                    to="/"
                    prefetch="intent"
                    className={desktopLinkClassName}
                >
                    Overview
                </NavLink>

                <NavLink
                    to="/insights"
                    prefetch="intent"
                    className={desktopLinkClassName}
                >
                    Insights
                </NavLink>

                <NavLink
                    to="/accounts"
                    prefetch="intent"
                    className={desktopLinkClassName}
                >
                    Accounts
                </NavLink>

                <NavLink
                    to="/capture"
                    prefetch="intent"
                    className={buttonVariants()}
                >
                    <PlusIcon />
                    New capture
                </NavLink>

                <NavLink
                    to="/settings"
                    prefetch="intent"
                    aria-label="Settings"
                    title="Settings"
                    className={({isActive}) =>
                        cn(
                            buttonVariants({variant: "ghost", size: "icon"}),
                            isActive && "bg-muted",
                        )
                    }
                >
                    <SettingsIcon />
                </NavLink>
            </nav>
        </>
    )
}

export default Navigation
