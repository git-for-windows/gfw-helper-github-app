const guessComponentUpdateDetails = (title) => {
    let [ , package_name, version ] =
        title.match(/^\[New (\S+) version\] (?:[^0-9]+\s+)?(\S+)/) ||
        title.match(/^(\S+): update to v?(\d[0-9.]\S*)/) ||
        []
    if (!package_name || !version) throw new Error(`Could not guess component-update details from title '${title}'`)

    if (['git-lfs', 'pcre2'].includes(package_name)) package_name = `mingw-w64-${package_name}`
    else if (['gcm-core', 'gcm'].includes(package_name)) package_name = 'mingw-w64-git-credential-manager'
    else if (package_name === 'cygwin') package_name = 'msys2-runtime'

    version = version
        .replace(/^(GCM |openssl-|OpenSSL_|v|V_|GnuTLS |tig-|Heimdal |cyginw-|PCRE2-)/, '')
        .replace('_', '.')
        .replace(/-release$/, '')

    return { package_name, version }
}

const prettyPackageName = (name) => {
    return {
        'git-credential-manager': 'Git Credential Manager',
        'git-lfs': 'Git LFS',
        'msys2-runtime': 'MSYS2 runtime',
        bash: 'Bash',
        curl: 'cURL',
        gnutls: 'GNU TLS',
        heimdal: 'Heimdal',
        mintty: 'MinTTY',
        openssh: 'OpenSSH',
        openssl: 'OpenSSL',
        pcre2: 'PCRE2',
        perl: 'Perl',
        tig: 'Tig',
    }[name] || name
}
const guessReleaseNotes = (issue) => {
    if (!issue.pull_request
        &&issue.labels.filter(label => label.name === 'component-update').length !== 1) throw new Error(`Cannot determine release note from issue ${issue.number}`)
    let { package_name, version } = guessComponentUpdateDetails(issue.title)

    package_name = prettyPackageName(package_name.replace(/^mingw-w64-/, ''))

    const urlMatch = issue.pull_request
        ? issue.body.match(/See (https:\/\/\S+) for details/)
        : issue.body.match(/(?:^|\n)(https:\/\/\S+)$/)
    if (!urlMatch) throw new Error(`Could not determine URL from issue ${issue.number}`)
    return {
        type: 'feature',
        message: `Comes with [${package_name} v${version}](${urlMatch[1]}).`
    }
}

module.exports = {
    guessComponentUpdateDetails,
    guessReleaseNotes,
    prettyPackageName
}