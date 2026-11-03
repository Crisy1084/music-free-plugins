// Bilibili 音乐 JS 插件
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const axios = require("axios");
const EMBEDDED_APIKEY = "sk-040090d9a3d83c1bc2db43ee1ba15a4a";

const pageSize = 20;
const PLATFORM_NAME = "bilibili";
const API_BASE = "https://api2.vsaa.cn/api/music/bili/index.php";

function getApiKey() {
  try {
    const userVariables = (typeof env !== "undefined" && env?.getUserVariables?.()) || {};
    return EMBEDDED_APIKEY || userVariables.key || userVariables.KEY || userVariables.apiKey || "";
  } catch (error) {
    return "";
  }
}

function getCookie() {
  try {
    const userVariables = (typeof env !== "undefined" && env?.getUserVariables?.()) || {};
    return [userVariables.BILI_COOKIE, userVariables.bili_cookie, userVariables.BILI_CK, userVariables.bili_ck,
      userVariables.CK, userVariables.ck, userVariables.COOKIE, userVariables.cookie, userVariables.Cookie,
      userVariables.SESSDATA, userVariables.sessdata].filter((v) => v !== undefined && v !== null && String(v).trim()).join("; ");
  } catch (error) {
    return "";
  }
}

async function callApi(params) {
  const key = getApiKey();
  if (!key) {
    throw new Error("请在插件设置-用户变量中填写 API Key (key)");
  }
  const res = await axios.get(API_BASE, {
    params: { ...params, key, cookie: getCookie() },
    timeout: 30000,
  });
  const payload = res.data || {};
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload;
}

// MusicFree 传入 low/standard/high/super，BakaMusic 传入 128k/320k 等，统一转换
function mapQuality(quality) {
  switch (quality) {
    case "low":
    case "standard":
      return "128k";
    case "high":
      return "320k";
    case "super":
      return "flac";
    default:
      return quality;
  }
}

function normalizeMusicItem(item) {
  return {
    id: String(item.id || ""),
    aid: item.aid || "",
    bvid: item.bvid || "",
    cid: item.cid || "",
    title: item.title || "",
    artist: item.artist || "",
    album: item.album || "",
    albumId: item.albumId || "",
    artwork: item.artwork || "",
    coverImg: item.coverImg || item.artwork || "",
    duration: item.duration || undefined,
    qualities: item.qualities || {},
    videoQualities: item.videoQualities || [],
    singerList: item.singerList || [],
    pages: item.pages || [],
    platform: PLATFORM_NAME,
  };
}

function normalizeArtistItem(item) {
  return {
    id: String(item.id || ""),
    mid: item.id || "",
    name: item.name || "",
    avatar: item.avatar || "",
    fans: item.fans || 0,
    worksNum: item.worksNum || 0,
    description: item.description || "",
  };
}

function normalizeSheetItem(item) {
  return {
    id: String(item.id || ""),
    title: item.title || "",
    artist: item.artist || "",
    artwork: item.artwork || "",
    description: item.description || "",
    worksNum: item.worksNum || 0,
    _bilibiliType: item._bilibiliType || "",
  };
}

function normalizeTopGroup(group) {
  return {
    title: group.title || "",
    data: (group.data || []).map((r) => ({
      id: String(r.id || ""),
      title: r.title || "",
      coverImg: r.coverImg || "",
      description: r.description || "",
    })),
  };
}

async function searchMusic(query, page) {
  const result = await callApi({ action: "search", keyword: query, page, type: "music" });
  return {
    isEnd: result.isEnd !== false,
    data: (result.data || []).map(normalizeMusicItem),
  };
}

async function searchAlbum(query, page) {
  const result = await callApi({ action: "search", keyword: query, page, type: "album" });
  return {
    isEnd: result.isEnd !== false,
    data: (result.data || []).map(normalizeMusicItem),
  };
}

async function searchArtist(query, page) {
  const result = await callApi({ action: "search", keyword: query, page, type: "artist" });
  return {
    isEnd: result.isEnd !== false,
    data: (result.data || []).map(normalizeArtistItem),
  };
}

async function searchSheet(query, page) {
  const result = await callApi({ action: "search", keyword: query, page, type: "sheet" });
  return {
    isEnd: result.isEnd !== false,
    data: (result.data || []).map(normalizeSheetItem),
  };
}

async function getMediaSource(musicItem, quality) {
  const id = musicItem.bvid || musicItem.aid || musicItem.id;
  if (!id) {
    throw new Error("无法识别的视频ID");
  }

  const params = { action: "musicSource", id, quality: mapQuality(quality) || "320k" };
  if (musicItem.cid) params.cid = musicItem.cid;

  const result = await callApi(params);
  if (!result.url) {
    throw new Error("获取播放链接失败，请稍后重试");
  }

  return {
    url: result.url,
    quality: result.quality || "128k",
    headers: result.headers || undefined,
    userAgent: result.userAgent || undefined,
  };
}

async function getMvSource(musicItem, videoQuality) {
  const id = musicItem.bvid || musicItem.aid || musicItem.id;
  if (!id) return null;

  const params = { action: "mvSource", id, video_quality: videoQuality || "1080p" };
  if (musicItem.cid) params.cid = musicItem.cid;

  const result = await callApi(params);
  if (!result.url) return null;

  return {
    url: result.url,
    userAgent: result.userAgent,
    videoQuality: result.videoQuality || "1080p",
    mimeType: result.mimeType || "video/mp4",
    width: result.width,
    height: result.height,
    duration: result.duration,
    availableVideoQualities: result.availableVideoQualities || [],
    backupUrls: result.backupUrls || [],
    headers: result.headers || undefined,
  };
}

async function getMusicInfo(musicBase) {
  const id = musicBase.bvid || musicBase.aid || musicBase.id;
  if (!id) return null;

  const result = await callApi({ action: "musicInfo", id });
  if (!result || !result.title) return null;

  return normalizeMusicItem(result);
}

async function getLyric(musicItem) {
  const id = musicItem.bvid || musicItem.aid || musicItem.id;
  if (!id) return { rawLrc: "" };

  const result = await callApi({ action: "lyric", id });
  return {
    rawLrc: result.rawLrc || "",
    artwork: result.artwork || undefined,
  };
}

async function getAlbumInfo(albumItem) {
  const id = albumItem.bvid || albumItem.aid || albumItem.id;
  if (!id) return { musicList: [] };

  const result = await callApi({ action: "albumInfo", id });
  return {
    albumItem: result.albumItem || albumItem,
    musicList: (result.musicList || []).map(normalizeMusicItem),
  };
}

async function getArtistWorks(artistItem, page, type) {
  const id = artistItem.mid || artistItem.id;
  if (!id) return { isEnd: true, data: [] };

  const result = await callApi({ action: "artistWorks", id, page, type: type || "music" });
  return {
    isEnd: result.isEnd !== false,
    data: (result.data || []).map(normalizeMusicItem),
  };
}

async function importMusicSheet(urlLike) {
  const result = await callApi({ action: "importSheet", url: urlLike });
  if (!result || result.error) return [];

  // MusicFree 的 importMusicSheet 要求返回歌曲数组（IMusicItem[]）
  if (Array.isArray(result)) {
    return result.map(normalizeMusicItem).filter((item) => item.id && item.title);
  }
  if (result.musicList && result.musicList.length) {
    return result.musicList.map(normalizeMusicItem).filter((item) => item.id && item.title);
  }
  if (result.title) {
    return [normalizeMusicItem(result)].filter((item) => item.id && item.title);
  }
  return [];
}

async function importMusicItem(urlLike) {
  const result = await callApi({ action: "importItem", url: urlLike });
  if (!result || !result.title) {
    throw new Error("无法识别的链接或ID");
  }
  return normalizeMusicItem(result);
}

async function getMusicSheetInfo(sheet) {
  const result = await callApi({ action: "sheetInfo", id: sheet.id });
  return {
    isEnd: result.isEnd !== false,
    sheetItem: result.sheetItem || sheet,
    musicList: (result.musicList || []).map(normalizeMusicItem),
  };
}

async function getTopLists() {
  const result = await callApi({ action: "topLists" });
  return (result || []).map(normalizeTopGroup);
}

async function getTopListDetail(topListItem) {
  const result = await callApi({ action: "topListDetail", id: topListItem.id });
  return {
    ...topListItem,
    musicList: (result.musicList || []).map(normalizeMusicItem),
  };
}

async function getMusicComments(musicItem, page = 1) {
  const id = musicItem.aid || musicItem.id;
  if (!id) return { isEnd: true, data: [] };

  const result = await callApi({ action: "comments", id, page });
  return {
    isEnd: result.isEnd !== false,
    data: result.data || [],
  };
}

async function getRecommendSheetTags() {
  const result = await callApi({ action: "recommendTags" });
  return {
    pinned: (result.pinned || []).map((t) => ({ id: String(t.id || ""), title: t.title || "" })),
    data: result.data || [],
  };
}

async function getRecommendSheetsByTag(tag, page) {
  const result = await callApi({ action: "recommendSheets", tag: tag?.id || "", page: page || 1 });
  return {
    isEnd: result.isEnd !== false,
    data: (result.data || []).map((s) => ({
      id: String(s.id || ""),
      title: s.title || "",
      artist: s.artist || "",
      artwork: s.artwork || "",
      description: s.description || "",
      worksNum: s.worksNum || 0,
      _bilibiliType: "video",
      musicList: (s.musicList || []).map(normalizeMusicItem),
    })),
  };
}

function getMusicDetailPageUrl(musicItem) {
  const bvid = musicItem.bvid || (typeof musicItem.id === "string" && /^BV/i.test(musicItem.id) ? musicItem.id : "");
  if (bvid) return `https://www.bilibili.com/video/${bvid}`;
  const aid = musicItem.aid || (/^\d+$/.test(String(musicItem.id || "")) ? musicItem.id : "");
  return aid ? `https://www.bilibili.com/video/av${aid}` : "";
}

module.exports = {
  platform: PLATFORM_NAME,
  author: "小趴菜",
  version: "20261103",
  appVersion: ">0.1.0-alpha.0",
  srcUrl: "https://github.com/Crisy1084/music-free-plugins/raw/release/dist/bilibili/index.js",
  cacheControl: "no-cache",
  supportedQualities: ["128k", "192k", "320k", "flac", "hires", "dolby"],
  supportedVideoQualities: ["360p", "480p", "720p", "720p60", "1080p", "1080p+", "1080p60", "4k", "hdr", "dolby_vision", "8k"],
  userVariables: [
    {
      key: "key",
      name: "API Key",
      hint: "填写 万象API 接口调用密钥",
    },
    {
      key: "SESSDATA",
      name: "Bilibili Cookie / SESSDATA",
      hint: "可填写浏览器完整 Cookie，或只填写 SESSDATA；登录后会重新探测会员、杜比和 Hi-Res 音质。",
    },
    {
      key: "BILI_COOKIE",
      name: "Bilibili 完整 Cookie（可选）",
      hint: "优先使用此字段。支持 buvid3、bili_jct、DedeUserID 等登录字段。",
    },
  ],
  hints: {
    importMusicSheet: [
      "支持收藏夹 URL、fid/media_id、/medialist/detail/ml数字，也支持直接粘贴 BV 视频链接（多分P会展开为歌单）",
      "私有收藏夹需要在用户变量中填写完整 Cookie；公开收藏夹可直接导入",
    ],
    importMusicItem: ["支持 BV/av 视频链接或直接输入 BV 号、AV 号"],
  },
  supportedSearchType: ["music", "album", "artist", "sheet"],

  async search(query, page, type) {
    if (type === "music") return await searchMusic(query, page);
    if (type === "album") return await searchAlbum(query, page);
    if (type === "artist") return await searchArtist(query, page);
    if (type === "sheet") return await searchSheet(query, page);
    return { isEnd: true, data: [] };
  },

  getMediaSource,
  getMvSource,
  getMusicInfo,
  getMusicDetailPageUrl,
  getLyric,
  getAlbumInfo,
  getArtistWorks,
  importMusicSheet,
  importMusicItem,
  getMusicSheetInfo,
  getTopLists,
  getTopListDetail,
  getMusicComments,
  getRecommendSheetTags,
  getRecommendSheetsByTag,
};
