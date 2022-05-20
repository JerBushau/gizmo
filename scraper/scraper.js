const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const url = (n) => `https://www.gizmoplex.com/mst3k/season:${n}`;

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const getSeasonCards = async (url) => {
  console.log("getting info from", url);
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  return $(".item-type-video .browse-item-card");
};

const rand = (low, high) => Math.floor(Math.random() * (high - low) + low);

const getDailyExp = (eps, prevs) => {
  while (true) {
    const ep = rand(0, eps.length - 1);
    const newDaily = eps[ep];
    if (
      !prevs.some(
        (d) =>
          Object.entries(d).toString() === Object.entries(newDaily).toString()
      )
    ) {
      return newDaily;
    }
  }
};

const parseSeasonInfo = (seasonCards) => {
  return seasonCards.map((c, i) => {
    const $ = cheerio.load(c);
    const link = $(".browse-item-link").attr("href").toString();
    const title = $(".browse-item-title").text().trim();
    const epNumber = $(".browse-item-subtext span.media-episode").text().trim();
    const season = link.split(":")[2].split("/")[0];
    return {
      link,
      title,
      epNumber,
      season,
    };
  });
};

const scrapeFullEpDescription = async (epInfo) => {
  for (let i = 0; i < epInfo.length; i++) {
    console.log(
      "getting description for",
      epInfo[i].title,
      `${i}/${epInfo.length}`
    );
    const { data } = await axios.get(epInfo[i].link);
    const $ = cheerio.load(data);

    epInfo[i].description = $("#watch-info p")
      .first()
      .text()
      .trim()
      .replace(/[\r\n]+/g, " ");

    await sleep(500);
  }

  return epInfo;
};

const gatherinfo = async (seasonUrls) => {
  let info = [];
  for (let i = 0; i < seasonUrls.length; i++) {
    const nextCards = await getSeasonCards(seasonUrls[i]);
    info = [...info, ...nextCards];
    await sleep(1000);
  }

  return info;
};

const run = async () => {
  const allSeasonUrls = Array.from(Array(10)).map((_, i) => url(i + 1));
  const oldWitLimit = 30;
  const info = parseSeasonInfo(await gatherinfo(allSeasonUrls));
  const oldDataJson = fs.readFileSync("./mst-info.json", "utf-8");
  const oldData = JSON.parse(oldDataJson);
  const foundNewData = info.length > oldData.eps.length;
  const epInfo = foundNewData
    ? await scrapeFullEpDescription(info)
    : oldData.eps;
  const dailyExp = getDailyExp(epInfo, oldData.oldWits || []);

  if ((oldData?.oldWits || []).length > oldWitLimit) {
    oldData.oldWits.shift();
  }

  const store = {
    eps: epInfo,
    wit: dailyExp,
    oldWits: [...(oldData?.oldWits || []), dailyExp],
    gatheredOn: new Date().toUTCString(),
  };

  fs.writeFile("./mst-info.json", JSON.stringify(store), (e, _) => {
    if (e) {
      return console.error("failed", e);
    }
    return console.log("mst info write successful");
  });
};

run();
