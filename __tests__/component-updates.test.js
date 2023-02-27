const {
    guessComponentUpdateDetails,
    guessReleaseNotes
} = require('../GitForWindowsHelper/component-updates')

const bashTicketBody = `# [New bash version] Bash-5.2 patch 15: fix too-aggressive optimizing forks out of subshell commands

<div type="text"/>

https://git.savannah.gnu.org/cgit/bash.git/commit/?id=ec8113b9861375e4e17b3307372569d429dec814

# [New bash version] Bash-5.2 patch 14: process additional terminating signals when running the EXIT trap after a terminating signal

<div type="text"/>

https://git.savannah.gnu.org/cgit/bash.git/commit/?id=6647917a43dd987c5564cc20d0943213b39e748b

# [New bash version] Bash-5.2 patch 13: fix memory leak referencing a nonexistent associative array element

<div type="text"/>

https://git.savannah.gnu.org/cgit/bash.git/commit/?id=52f2cda1a2156c8532f2f49391470cf2f66a1bd0`

test('guessComponentUpdateDetails()', () => {
    const titles = [
        ['[New cygwin version] cygwin-3.4.4', 'msys2-runtime', '3.4.4'],
        ['[New libcbor version] v0.10.2', 'libcbor', '0.10.2'],
        ['[New openssl version] OpenSSL 1.1.1s', 'openssl', '1.1.1s'],
        ['[New openssh version] V_9_2_P1', 'openssh', '9.2.P1'],
        ['[New tig version] tig-2.5.8', 'tig', '2.5.8'],
        ['[New curl version] 7.87.0', 'curl', '7.87.0'],
        ['[New mintty version] 3.6.3', 'mintty', '3.6.3'],
        ['[New pcre2 version] PCRE2-10.42', 'pcre2', '10.42'],
        ['[New git-lfs version] v3.3.0', 'mingw-w64-git-lfs', '3.3.0'],
        ['[New heimdal version] Heimdal 7.7.1 - Security Fix Release', 'heimdal', '7.7.1'],
        ['[New gnutls version] GnuTLS 3.8.0', 'gnutls', '3.8.0'],
        ['[New git-credential-manager version] GCM 2.0.886', 'mingw-w64-git-credential-manager', '2.0.886']
    ]
    for (const [title, package_name, version] of titles) {
        expect(guessComponentUpdateDetails(title)).toEqual({ package_name, version })
    }

    expect(guessComponentUpdateDetails('[New bash version] 3 new items', bashTicketBody)).toEqual({
        package_name: 'bash',
        version: '5.2.15'
    })
})

let mockGithubApiRequest = jest.fn(() => {
    return {
    }
})
jest.mock('../GitForWindowsHelper/github-api-request', () => {
    return mockGithubApiRequest
})

test('guessReleaseNotes()', async () => {
    const context = { log: jest.fn() }
    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New bash version] 3 new items',
        body: bashTicketBody
    })).toEqual({
        type: 'feature',
        message: 'Comes with [Bash v5.2.15](https://git.savannah.gnu.org/cgit/bash.git/commit/?id=ec8113b9861375e4e17b3307372569d429dec814).'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New gnutls version] GnuTLS 3.8.0',
        body: `Released a bug-fix and enhancement release on the 3.8.x branch.[GnuTLS 3.8.0](https://lists.gnupg.org/pipermail/gnutls-help/2023-February/004816.html)

Added the security advisory.[GNUTLS-SA-2020-07-14](security-new.html#GNUTLS-SA-2020-07-14)

http://www.gnutls.org/news.html#2023-02-10`
    })).toEqual({
        type: 'feature',
        message: 'Comes with [GNU TLS v3.8.0](https://lists.gnupg.org/pipermail/gnutls-help/2023-February/004816.html).'
    })
})