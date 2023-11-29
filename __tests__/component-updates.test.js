const {
    guessComponentUpdateDetails,
    guessReleaseNotes,
    getMissingDeployments
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
        ['[New curl version] curl-8_1_1', 'curl', '8.1.1'],
        ['[New mintty version] 3.6.3', 'mintty', '3.6.3'],
        ['[New pcre2 version] PCRE2-10.42', 'pcre2', '10.42'],
        ['[New git-lfs version] v3.3.0', 'mingw-w64-git-lfs', '3.3.0'],
        ['[New heimdal version] Heimdal 7.7.1 - Security Fix Release', 'heimdal', '7.7.1'],
        ['[New gnutls version] GnuTLS 3.8.0', 'gnutls', '3.8.0'],
        ['[New git-credential-manager version] GCM 2.0.886', 'mingw-w64-git-credential-manager', '2.0.886'],
        ['[New gpg version] gnupg-2.2.42', 'gnupg', '2.2.42']
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

const mockFetchHTML = {
    'https://cygwin.com': `<div>

<h2 class="cartouche">Cygwin version</h2>

<p>
    The most recent version of the Cygwin DLL is
    <b><a href="https://cygwin.com/pipermail/cygwin-announce/2023-September/011291.html">3.4.9</a></b>.
</p>
<p>
    The Cygwin DLL currently works with all recent, commercially released
    x86_64 versions of Windows, starting with Windows 7.
</p>
</div>`,
    'https://inbox.sourceware.org/cygwin-announce/?q=cygwin-3.4.7': `<html><head><title>cygwin-3.4.7 - search results</title>[... plenty of stuff...]
<pre>1. <b><a
href="875y7c63s1.fsf@Rainer.invalid/">Re-Released: tar-1.34-2</a></b>
    - by ASSI @ 2023-06-24 19:47 UTC [4%]

2. <b><a
href="20230616162552.879387-1-corinna-cygwin@cygwin.com/">cygwin 3.4.7-1</a></b>
    - by Corinna Vinschen @ 2023-06-16 14:25 UTC [14%]

</pre>[... even more stuff...]</body></html>`
}
const missingURL = 'https://wingit.blob.core.windows.net/x86-64/curl-8.1.2-1-x86_64.pkg.tar.xz'
const missingMinTTYURL = 'https://wingit.blob.core.windows.net/i686/mintty-1~3.6.5-1-i686.pkg.tar.xz'
const bogus32BitMSYS2RuntimeURL = 'https://wingit.blob.core.windows.net/i686/msys2-runtime-3.4.9-1-i686.pkg.tar.xz'
const bogus64BitMSYS2RuntimeURL = 'https://wingit.blob.core.windows.net/x86-64/msys2-runtime-3.3-3.3.7-1-x86_64.pkg.tar.xz'
const missingOpenSSHURL = 'https://wingit.blob.core.windows.net/i686/openssh-9.5p1-1-i686.pkg.tar.xz'
const missingBashURL = 'https://wingit.blob.core.windows.net/x86-64/bash-5.2.020-1-x86_64.pkg.tar.xz'
const mockDoesURLReturn404 = jest.fn(url => [
    missingURL, missingMinTTYURL, bogus32BitMSYS2RuntimeURL, bogus64BitMSYS2RuntimeURL, missingOpenSSHURL, missingBashURL
].includes(url))
jest.mock('../GitForWindowsHelper/https-request', () => {
    return {
        doesURLReturn404: mockDoesURLReturn404,
        fetchHTML: jest.fn(url => mockFetchHTML[url])
    }
})


test('guessReleaseNotes()', async () => {
    const context = { log: jest.fn() }
    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New bash version] 3 new items',
        body: bashTicketBody
    })).toEqual({
        type: 'feature',
        message: 'Comes with [Bash v5.2.15](https://git.savannah.gnu.org/cgit/bash.git/commit/?id=ec8113b9861375e4e17b3307372569d429dec814).',
        package: 'bash',
        version: '5.2.15'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New gnutls version] GnuTLS 3.8.0',
        body: `Released a bug-fix and enhancement release on the 3.8.x branch.[GnuTLS 3.8.0](https://lists.gnupg.org/pipermail/gnutls-help/2023-February/004816.html)

Added the security advisory.[GNUTLS-SA-2020-07-14](security-new.html#GNUTLS-SA-2020-07-14)

http://www.gnutls.org/news.html#2023-02-10`
    })).toEqual({
        type: 'feature',
        message: 'Comes with [GNU TLS v3.8.0](https://lists.gnupg.org/pipermail/gnutls-help/2023-February/004816.html).',
        package: 'gnutls',
        version: '3.8.0'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New perl version] v5.36.1',
        body: `\nhttps://github.com/Perl/perl5/releases/tag/v5.36.1`
    })).toEqual({
        type: 'feature',
        message: 'Comes with [Perl v5.36.1](http://search.cpan.org/dist/perl-5.36.1/pod/perldelta.pod).',
        package: 'perl',
        version: '5.36.1'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New curl version] curl-8_1_1',
        body: `\nhttps://github.com/curl/curl/releases/tag/curl-8_1_1`
    })).toEqual({
        type: 'feature',
        message: 'Comes with [cURL v8.1.1](https://curl.se/changes.html#8_1_1).',
        package: 'curl',
        version: '8.1.1'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New openssl version] OpenSSL 1.1.1u',
        body: `\nhttps://github.com/openssl/openssl/releases/tag/OpenSSL_1_1_1u`
    })).toEqual({
        type: 'feature',
        message: 'Comes with [OpenSSL v1.1.1u](https://www.openssl.org/news/openssl-1.1.1-notes.html).',
        package: 'openssl',
        version: '1.1.1u'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New openssl version] OpenSSL 3.1.1',
        body: `\nhttps://github.com/openssl/openssl/releases/tag/openssl-3.1.1`
    })).toEqual({
        type: 'feature',
        message: 'Comes with [OpenSSL v3.1.1](https://www.openssl.org/news/openssl-3.1-notes.html).',
        package: 'openssl',
        version: '3.1.1'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New cygwin version] cygwin-3.4.9',
        body: `\nCygwin 3.4.9 release\n\nhttps://github.com/cygwin/cygwin/releases/tag/cygwin-3.4.9`
    })).toEqual({
        type: 'feature',
        message: 'Comes with the MSYS2 runtime (Git for Windows flavor) based on [Cygwin v3.4.9](https://cygwin.com/pipermail/cygwin-announce/2023-September/011291.html).',
        package: 'msys2-runtime',
        version: '3.4.9'
    })

    expect(await guessReleaseNotes(context, {
        labels: [{ name: 'component-update' }],
        title: '[New cygwin version] cygwin-3.4.7',
        body: `\nCygwin 3.4.7 release\n\nhttps://github.com/cygwin/cygwin/releases/tag/cygwin-3.4.7`
    })).toEqual({
        type: 'feature',
        message: 'Comes with the MSYS2 runtime (Git for Windows flavor) based on [Cygwin v3.4.7](https://inbox.sourceware.org/cygwin-announce/20230616162552.879387-1-corinna-cygwin@cygwin.com/).',
        package: 'msys2-runtime',
        version: '3.4.7'
    })
})

test('getMissingDeployments()', async () => {
    expect(await getMissingDeployments('curl', '8.1.2')).toEqual([missingURL])
    expect(await getMissingDeployments('mintty', '3.6.5')).toEqual([missingMinTTYURL])
    expect(await getMissingDeployments('msys2-runtime', '3.4.9')).toEqual([])
    expect(await getMissingDeployments('msys2-runtime-3.3', '3.3.7')).toEqual([])
    expect(await getMissingDeployments('openssh', '9.5.P1')).toEqual([missingOpenSSHURL])
    expect(await getMissingDeployments('bash', '5.2.20')).toEqual([missingBashURL])
})
