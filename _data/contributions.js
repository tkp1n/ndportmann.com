function repoUrl(prUrl) {
    const prUrlParts = prUrl.split('/');
    return prUrlParts.slice(0, prUrlParts.length - 2).join('/');
}

function repoName(repoUrl) {
    const repoUrlParts = repoUrl.split('/');
    return repoUrlParts.slice(repoUrlParts.length - 2).join('/');
}

function prId(prUrl) {
    const prUrlParts = prUrl.split('/');
    return `#${prUrlParts[prUrlParts.length - 1]}`;
}

module.exports = function () {
    const source = [
        {
            repoImg: 'https://avatars.githubusercontent.com/u/25224152?s=20&v=4',
            prUrl: 'https://github.com/SixLabors/ImageSharp/pull/1517',
            prTitle: 'Vectorize Scale16X16To8X8'
        },
        {
            repoImg: 'https://avatars.githubusercontent.com/u/25224152?s=20&v=4',
            prUrl: 'https://github.com/SixLabors/ImageSharp/pull/1508',
            prTitle: 'Vectorize Jpeg Encoder Color Conversion'
        },
        {
            repoImg: 'https://avatars.githubusercontent.com/u/25224152?s=20&v=4',
            prUrl: 'https://github.com/SixLabors/ImageSharp/pull/1411',
            prTitle: 'Vectorize (AVX2) JPEG Color Converter'
        },
        {
            repoImg: 'https://avatars.githubusercontent.com/u/9141961?s=20&v=4',
            prUrl: 'https://github.com/dotnet/efcore/pull/23014',
            prTitle: 'Avoid lambda capture of cancellation token'
        },
        {
            repoImg: 'https://avatars.githubusercontent.com/u/9141961?s=20&v=4',
            prUrl: 'https://github.com/dotnet/runtime/pull/37546',
            prTitle: 'Add methods to convert between hexadecimal strings and bytes'
        },
        {
            repoImg: 'https://avatars.githubusercontent.com/u/9141961?s=20&v=4',
            prUrl: 'https://github.com/dotnet/corefx/pull/34386',
            prTitle: 'Utf8JsonReader should store if parsed number contains exponent'
        }
    ];

    return source.map(x => ({
        ...x,
        repoUrl: repoUrl(x.prUrl),
        repoName: repoName(repoUrl(x.prUrl)),
        prId: prId(x.prUrl)
    }));
};