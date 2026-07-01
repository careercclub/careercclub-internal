export type ContentMetrics = Record<string, unknown>;

function number(row: ContentMetrics, key: string) {
  const value = Number(row[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function present(row: ContentMetrics, key: string) {
  return row[key] !== null && row[key] !== undefined && row[key] !== "";
}

function normalized(score: number, maximum: number) {
  return maximum > 0 ? Math.min(100, Math.round(score / maximum * 100)) : 0;
}

export function scoreContentEvaluation(row: ContentMetrics) {
  const format = String(row.format || "").toLowerCase();
  const reach = number(row, "reach");
  const likes = number(row, "likes");
  const comments = number(row, "comments");
  const saves = number(row, "saves");
  const shares = number(row, "shares");
  const follows = number(row, "follows");
  const linkTaps = number(row, "link_taps");
  const nfPct = number(row, "nf_pct");
  const saveRate = reach ? saves / reach * 100 : 0;
  const shareRate = reach ? shares / reach * 100 : 0;
  const followRate = reach ? follows / reach * 100 : 0;
  const linkRate = reach ? linkTaps / reach * 100 : 0;
  const engagementRate = reach ? (likes + comments + saves + shares) / reach * 100 : 0;
  let score = 0;
  let maximum = 0;

  if (format.includes("story")) {
    const views = number(row, "views") || reach;
    const exits = number(row, "exits");
    const replies = number(row, "replies");
    const tapsBack = number(row, "taps_back");
    const stickers = number(row, "stickers_interact");
    const exitRate = views ? exits / views * 100 : 0;
    const replyRate = views ? replies / views * 100 : 0;
    const tapsBackRate = views ? tapsBack / views * 100 : 0;
    const storyLinkRate = views ? linkTaps / views * 100 : 0;
    const hasExit = present(row, "exits");
    const hasReply = present(row, "replies");
    const hasTapsBack = present(row, "taps_back");
    const hasLink = present(row, "link_taps");

    if (hasExit) {
      maximum += 30;
      score += exitRate <= 15 ? 30 : exitRate <= 30 ? 18 : 6;
    }
    if (hasTapsBack) {
      maximum += 20;
      score += tapsBackRate >= 10 ? 20 : tapsBackRate >= 5 ? 12 : 0;
    }
    if (hasReply) {
      maximum += 25;
      score += replyRate >= 2 ? 25 : replyRate >= .5 ? 12 : 0;
    }
    if (hasLink) {
      maximum += 20;
      score += storyLinkRate >= 3 ? 20 : storyLinkRate >= 1 ? 10 : 0;
    }
    maximum += 5;
    if (stickers > 0) score += 5;

    return maximum <= 5 ? 0 : normalized(score, maximum);
  }

  if (format.includes("reel")) {
    const wtr = number(row, "wtr");
    const hasWtr = present(row, "wtr");
    const hasNf = present(row, "nf_pct");
    const hasLink = present(row, "link_taps");
    if (hasWtr) { maximum += 35; score += wtr >= 40 ? 35 : wtr >= 30 ? 28 : wtr >= 20 ? 18 : wtr > 0 ? 8 : 0; }
    if (hasNf) { maximum += 25; score += nfPct >= 60 ? 25 : nfPct >= 45 ? 18 : nfPct >= 30 ? 10 : nfPct > 0 ? 4 : 0; }
    maximum += 20; score += followRate >= 1.5 ? 20 : followRate >= .8 ? 14 : followRate >= .3 ? 7 : 0;
    if (hasLink) { maximum += 10; score += linkRate >= 2 ? 10 : linkRate >= 1 ? 7 : linkRate >= .3 ? 4 : 0; }
    maximum += 10; score += saveRate >= 3 ? 5 : saveRate >= 1 ? 3 : 0; score += shareRate >= 1.5 ? 5 : shareRate >= .5 ? 3 : 0;
    if (!(hasWtr && hasNf)) { maximum += 15; score += engagementRate >= 8 ? 15 : engagementRate >= 4 ? 10 : engagementRate >= 2 ? 5 : 0; }
  } else {
    const hasNf = present(row, "nf_pct");
    const hasLink = present(row, "link_taps");
    maximum += 35; score += followRate >= 1.5 ? 35 : followRate >= 1 ? 26 : followRate >= .5 ? 15 : 0;
    if (hasLink) { maximum += 25; score += linkRate >= 2 ? 25 : linkRate >= 1 ? 18 : linkRate >= .4 ? 10 : 0; }
    maximum += 15; score += saveRate >= 5 ? 15 : saveRate >= 2 ? 10 : saveRate >= 1 ? 5 : 0;
    maximum += 10; score += shareRate >= 1 ? 10 : shareRate >= .4 ? 5 : 0;
    if (hasNf) { maximum += 10; score += nfPct >= 60 ? 10 : nfPct >= 40 ? 6 : nfPct > 0 ? 2 : 0; }
    maximum += 5; score += comments >= 100 ? 5 : comments >= 40 ? 3 : 0;
    if (!(hasNf && hasLink)) { maximum += 15; score += engagementRate >= 8 ? 15 : engagementRate >= 4 ? 10 : engagementRate >= 2 ? 5 : 0; }
  }
  return normalized(score, maximum);
}

export function scoreAdsCandidate(row: ContentMetrics) {
  const reach = number(row, "reach");
  const views = number(row, "views");
  const saves = number(row, "saves");
  const comments = number(row, "comments");
  const shares = number(row, "shares");
  const likes = number(row, "likes");
  const profile = number(row, "profile_visits");
  const isReel = String(row.format || "").toLowerCase().includes("reel");
  const scoreViews = isReel ? views : views || reach;
  const saveRate = reach ? saves / reach : 0;
  const engagementRate = reach ? (likes + comments + saves + shares) / reach : 0;
  const profileRate = reach ? profile / reach : 0;
  let score = reach >= 15000 ? 3 : reach >= 7000 ? 2 : reach >= 3000 ? 1 : 0;
  score += scoreViews >= 10000 ? 3 : scoreViews >= 3000 ? 2 : scoreViews >= 1000 ? 1 : 0;
  score += saveRate >= .04 ? 4 : saveRate >= .02 ? 2 : saveRate >= .01 ? 1 : 0;
  score += comments >= 80 ? 2 : comments >= 30 ? 1 : 0;
  score += profileRate >= .02 ? 3 : profileRate >= .01 ? 1 : 0;
  score += shares >= 200 ? 2 : shares >= 50 ? 1 : 0;
  const intent = profileRate >= .015 || comments >= 60;
  const strongSave = saveRate >= .025;
  if (intent && strongSave) return { score: Math.min(score, 10), funnel: "BOFU", objective: comments >= 60 ? "Messages" : "Lead Generation" };
  if (strongSave || (comments >= 40 && engagementRate >= .04)) return { score: Math.min(score, 10), funnel: "MOFU", objective: "Traffic" };
  if ((isReel && views >= 5000) || reach >= 10000) return { score: Math.min(score, 10), funnel: "TOFU", objective: isReel && views >= 5000 ? "Video Views / ThruPlay" : "Reach" };
  return { score: Math.min(score, 10), funnel: score >= 4 ? "MOFU" : "TOFU", objective: score >= 6 ? "Traffic" : "Reach" };
}
