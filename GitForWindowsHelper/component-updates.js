const guessComponentUpdateDetails = (title) => {
    let [ , package_name, , version ] = title.match(/^\[New (\S+) version\] ([^0-9]+\s+)?(\S+)/) || []
    if (!package_name || !version) throw new Error(`Could not guess component-update details from title '${title}'`)

    if (package_name === 'git-lfs') package_name = `mingw-w64-${package_name}`
    else if (['gcm-core', 'gcm'].includes(package_name)) package_name = 'mingw-w64-git-credential-manager'
    else if (package_name === 'cygwin') package_name = 'msys2-runtime'

    version = version
        .replace(/^(GCM |openssl-|OpenSSL_|v|V_|GnuTLS |tig-|Heimdal |cyginw-)/, '')
        .replace('_', '.')
        .replace(/-release$/, '')

    return { package_name, version }
}

module.exports = {
    guessComponentUpdateDetails
}