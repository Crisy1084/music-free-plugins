import axios from "axios";
import CryptoJs = require("crypto-js");

const pageSize = 25;


async function httpGet(
  urlPath: string,
  params?: Record<string, string | number | boolean>
) {
  const userVariables = env?.getUserVariables() ?? {};
  // @ts-ignore
  let { url, username, password } = userVariables;
  console.log(userVariables);
  if (!(url && username && password)) {
    return null;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `http://${url}`;
  }

  const salt = Math.random().toString(16).slice(2);
  const preParams = {
    u: username,
    s: salt,
    t: CryptoJs.MD5(`${password}${salt}`).toString(CryptoJs.enc.Hex),
    c: "MusicFree",
    v: "1.14.1",
    f: "json",
  };


  return (
    await axios.get(`${url}/rest/${urlPath}`, {
      params: {
        ...preParams,
        ...params
      },
    })
  ).data;
}

// httpGet('search2', {
//     query: 'Fl00t',
//     artistCount: pageSize
// }).then(e => console.log(JSON.stringify(e, undefined, 4)))
// httpGet('download', {
//     id: '9724c9544a4bd2a042c43bfe41d1aec4',
// }).then(e => console.log(JSON.stringify(e, undefined, 4)))


function formatMusicItem(it) {
    return {
        ...it,
        artwork: it.coverArt
    }
}

function formatAlbumItem(it) {
    return {
        ...it,
        artwork: it.coverArt
    }
}


function formatArtistItem(it) {
    return {
        ...it,
        avatar: it.artistImageUrl
    }
}

async function searchMusic(query, page){
    const data = await httpGet('search2', {
        query,
        songCount: pageSize,
        songOffset: (page - 1) * pageSize
    });

    const songs = data['subsonic-response'].searchResult2.song;

    return {
        isEnd: songs.length < pageSize,
        data: songs.map(formatMusicItem)
    }
}

async function searchAlbum(query, page){
    const data = await httpGet('search2', {
        query,
        albumCount: pageSize,
        albumOffset: (page - 1) * pageSize
    });

    const songs = data['subsonic-response'].searchResult2.album;

    return {
        isEnd: songs.length < pageSize,
        data: songs.map(formatAlbumItem)
    }
}

async function searchArtist(query, page){
    const data = await httpGet('search2', {
        query,
        songCount: pageSize,
        songOffset: (page - 1) * pageSize
    });

    const songs = data['subsonic-response'].searchResult2.song;

    return {
        isEnd: songs.length < pageSize,
        data: songs.map(formatMusicItem)
    }
}

async function getAlbumInfo(albumItem) {
    const data = await httpGet('getAlbum', {
        id: albumItem.id
    });
    return {
        isEnd: true,
        data: data['subsonic-response'].album.song.map(formatMusicItem)
    };

}


module.exports = {
  platform: "Navidrome",
  version: "0.0.0",
  author: '猫大神',
  appVersion: ">0.1.0-alpha.0",
  srcUrl:
    "https://gitee.com/crisy/music-free-plugins/raw/release/dist/navidrome/index.js",
  cacheControl: "no-cache",
  userVariables: [
    {
      key: "url",
      name: "服务器地址",
    },
    {
      key: "username",
      name: "用户名",
    },
    {
      key: "password",
      name: "密码",
    },
  ],
  supportedSearchType: ["music", "album"],
  async search(query, page, type) {
    if (type === "music") {
      return await searchMusic(query, page);
    }
    if (type === "album") {
      return await searchAlbum(query, page);
    }
  },

  async getMediaSource(musicItem){
    const userVariables = env?.getUserVariables() ?? {};
    // @ts-ignore
    let { url, username, password } = userVariables;
    if (!(url && username && password)) {
      return null;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `http://${url}`;
    }
  
    const salt = Math.random().toString(16).slice(2);

    const urlObj = new URL(`${url}/rest/stream`);
    urlObj.searchParams.append('u', username);
    urlObj.searchParams.append('s', salt);
    urlObj.searchParams.append('t', CryptoJs.MD5(`${password}${salt}`).toString(CryptoJs.enc.Hex));
    urlObj.searchParams.append('c', 'MusicFree');
    urlObj.searchParams.append('v', '1.14.1');
    urlObj.searchParams.append('f', 'json');
    urlObj.searchParams.append('id', musicItem.id);

    return {
        url: urlObj.toString()
    }
  }
};
