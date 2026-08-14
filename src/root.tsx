import {Links, Meta, Outlet, Scripts, ScrollRestoration} from "react-router"

import Error from "~/components/ErrorBoundary"
import Header from "~/components/Header"
import tailwindStyles from "~/styles/tailwind.css?url"

const App = () => {
    return (
        <html lang="en">
            <head>
                <title>wealth</title>
                <link rel="stylesheet" href={tailwindStyles} />
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="32x32"
                    href="/favicon-32x32.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="16x16"
                    href="/favicon-16x16.png"
                />
                <link
                    rel="apple-touch-icon"
                    sizes="180x180"
                    href="/apple-touch-icon.png"
                />
                <link
                    rel="apple-touch-icon-precomposed"
                    sizes="180x180"
                    href="/apple-touch-icon-precomposed.png"
                />
                <link
                    rel="mask-icon"
                    href="/safari-pinned-tab.svg"
                    color="#111111"
                />
                <meta charSet="utf-8" />

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />

                <meta
                    httpEquiv="Content-Type"
                    content="text/html;charset=utf-8"
                />

                <Meta />
                <Links />
            </head>

            <body className="relative bg-white text-black">
                <div className="isolate grid min-h-screen grid-rows-[auto_1fr] pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
                    <Header />

                    <div className="min-w-0 p-4 sm:p-8">
                        <Outlet />
                    </div>
                </div>

                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    )
}

export const ErrorBoundary = () => {
    return (
        <html lang="en">
            <head>
                <title>wealth</title>
                <link rel="stylesheet" href={tailwindStyles} />
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="32x32"
                    href="/favicon-32x32.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="16x16"
                    href="/favicon-16x16.png"
                />
                <link
                    rel="apple-touch-icon"
                    sizes="180x180"
                    href="/apple-touch-icon.png"
                />
                <link
                    rel="apple-touch-icon-precomposed"
                    sizes="180x180"
                    href="/apple-touch-icon-precomposed.png"
                />
                <link
                    rel="mask-icon"
                    href="/safari-pinned-tab.svg"
                    color="#111111"
                />
                <meta charSet="utf-8" />

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />

                <meta
                    httpEquiv="Content-Type"
                    content="text/html;charset=utf-8"
                />

                <Meta />
                <Links />
            </head>

            <body className="relative bg-white text-black">
                <Error />
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    )
}

export default App
