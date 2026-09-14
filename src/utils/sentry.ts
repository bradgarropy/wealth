import pkg from "../../package.json" with {type: "json"}

const createRelease = () => {
    const release = `${pkg.name}@${pkg.version}`
    return release
}

export {createRelease}
