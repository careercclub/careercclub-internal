export type ContentMetrics = Record<string, unknown>;

export type ContentInsight = {
  type: "positive" | "neutral" | "warning";
  text: string;
};

export type ContentEvaluationResult = {
  total: number;
  grade: "top" | "good" | "avg" | "low";
  partial: boolean;
  rates: Record<string, number>;
  insights: ContentInsight[];
};

function number(row: ContentMetrics, key: string) {
  const value = Number(row[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function present(row: ContentMetrics, key: string) {
  return row[key] !== null && row[key] !== undefined && row[key] !== "";
}

function result(score: number, maximum: number, partial: boolean, rates: Record<string, number>, insights: ContentInsight[]): ContentEvaluationResult {
  const total = maximum > 0 ? Math.min(100, Math.round(score / maximum * 100)) : 0;
  const grade = total >= 80 ? "top" : total >= 60 ? "good" : total >= 40 ? "avg" : "low";
  return { total, grade, partial, rates, insights };
}

function evaluateStory(row: ContentMetrics): ContentEvaluationResult {
  const views = number(row, "views") || number(row, "reach");
  const exits = number(row, "exits");
  const replies = number(row, "replies");
  const tapsBack = number(row, "taps_back");
  const linkTaps = number(row, "link_taps");
  const stickers = number(row, "stickers_interact");
  const exitRate = views ? exits / views * 100 : 0;
  const replyRate = views ? replies / views * 100 : 0;
  const tapsBackRate = views ? tapsBack / views * 100 : 0;
  const linkRate = views ? linkTaps / views * 100 : 0;
  const hasExit = present(row, "exits");
  const hasReply = present(row, "replies");
  const hasTapsBack = present(row, "taps_back");
  const hasLink = present(row, "link_taps");
  const partial = !(hasExit && hasReply);
  const insights: ContentInsight[] = [];
  let score = 0;
  let maximum = 0;

  if (hasExit) {
    maximum += 30;
    if (exitRate <= 15) { score += 30; insights.push({ type: "positive", text: `Exit rate ${exitRate.toFixed(1)}% rendah - audience betah.` }); }
    else if (exitRate <= 30) { score += 18; insights.push({ type: "neutral", text: `Exit rate ${exitRate.toFixed(1)}% - bisa dioptimasi.` }); }
    else { score += 6; insights.push({ type: "warning", text: `Exit rate ${exitRate.toFixed(1)}% tinggi.` }); }
  }
  if (hasTapsBack) {
    maximum += 20;
    if (tapsBackRate >= 10) { score += 20; insights.push({ type: "positive", text: `Taps back ${tapsBackRate.toFixed(1)}% - konten menarik.` }); }
    else if (tapsBackRate >= 5) score += 12;
  }
  if (hasReply) {
    maximum += 25;
    if (replyRate >= 2) { score += 25; insights.push({ type: "positive", text: `Reply rate ${replyRate.toFixed(1)}% - memancing percakapan.` }); }
    else if (replyRate >= .5) score += 12;
  }
  if (hasLink) {
    maximum += 20;
    if (linkRate >= 3) { score += 20; insights.push({ type: "positive", text: `Link tap rate ${linkRate.toFixed(1)}% - CTA sticker efektif.` }); }
    else if (linkRate >= 1) score += 10;
  }
  maximum += 5;
  if (stickers > 0) score += 5;
  const rates = { exitRate, replyRate, linkRate, tapsBackRate };
  if (maximum <= 5) return { total: 0, grade: "low", partial: true, rates, insights: [{ type: "neutral", text: "Story membutuhkan input manual: Exits, Replies, Taps back, dan Link taps." }] };
  if (partial) insights.push({ type: "neutral", text: "Skor preliminary - lengkapi metric Story manual." });
  return result(score, maximum, partial, rates, insights);
}

function evaluateReel(row: ContentMetrics): ContentEvaluationResult {
  const reach = number(row, "reach");
  const likes = number(row, "likes");
  const comments = number(row, "comments");
  const saves = number(row, "saves");
  const shares = number(row, "shares");
  const follows = number(row, "follows");
  const linkTaps = number(row, "link_taps");
  const wtr = number(row, "wtr");
  const nfPct = number(row, "nf_pct");
  const saveRate = reach ? saves / reach * 100 : 0;
  const shareRate = reach ? shares / reach * 100 : 0;
  const followRate = reach ? follows / reach * 100 : 0;
  const linkRate = reach ? linkTaps / reach * 100 : 0;
  const engRate = reach ? (likes + comments + saves + shares) / reach * 100 : 0;
  const hasWtr = present(row, "wtr");
  const hasNf = present(row, "nf_pct");
  const hasLink = present(row, "link_taps");
  const partial = !(hasWtr && hasNf);
  const insights: ContentInsight[] = [];
  let score = 0;
  let maximum = 0;

  if (hasWtr) {
    maximum += 35;
    if (wtr >= 40) { score += 35; insights.push({ type: "positive", text: `WTR ${wtr}% luar biasa. Hook dan storytelling premium.` }); }
    else if (wtr >= 30) { score += 28; insights.push({ type: "positive", text: `WTR ${wtr}% sangat baik.` }); }
    else if (wtr >= 20) { score += 18; insights.push({ type: "neutral", text: `WTR ${wtr}% cukup, cek drop-off.` }); }
    else if (wtr > 0) { score += 8; insights.push({ type: "warning", text: `WTR ${wtr}% rendah, perkuat hook.` }); }
  }
  if (hasNf) {
    maximum += 25;
    if (nfPct >= 60) { score += 25; insights.push({ type: "positive", text: `Non-follower reach ${nfPct}% - kandidat boost TOFU.` }); }
    else if (nfPct >= 45) { score += 18; insights.push({ type: "positive", text: `Non-follower reach ${nfPct}% - distribusi kuat.` }); }
    else if (nfPct >= 30) { score += 10; insights.push({ type: "neutral", text: `Non-follower reach ${nfPct}% - cukup.` }); }
    else if (nfPct > 0) { score += 4; insights.push({ type: "warning", text: `Non-follower reach ${nfPct}% - terbatas.` }); }
  }
  maximum += 20;
  if (followRate >= 1.5) { score += 20; insights.push({ type: "positive", text: `Follow rate ${followRate.toFixed(2)}% - top-tier.` }); }
  else if (followRate >= .8) { score += 14; insights.push({ type: "positive", text: `Follow rate ${followRate.toFixed(2)}% - efektif.` }); }
  else if (followRate >= .3) score += 7;
  else if (reach > 0) insights.push({ type: "warning", text: "Follow rate rendah - CTA follow kurang kuat." });
  if (hasLink) {
    maximum += 10;
    if (linkRate >= 2) { score += 10; insights.push({ type: "positive", text: `Link tap rate ${linkRate.toFixed(1)}% - CTA bio maksimal.` }); }
    else if (linkRate >= 1) score += 7;
    else if (linkRate >= .3) score += 4;
  }
  maximum += 10;
  score += saveRate >= 3 ? 5 : saveRate >= 1 ? 3 : 0;
  score += shareRate >= 1.5 ? 5 : shareRate >= .5 ? 3 : 0;
  if (partial) {
    maximum += 15;
    if (engRate >= 8) { score += 15; insights.push({ type: "positive", text: `Engagement rate ${engRate.toFixed(1)}% sangat tinggi.` }); }
    else if (engRate >= 4) { score += 10; insights.push({ type: "positive", text: `Engagement rate ${engRate.toFixed(1)}% baik.` }); }
    else if (engRate >= 2) { score += 5; insights.push({ type: "neutral", text: `Engagement rate ${engRate.toFixed(1)}% sedang.` }); }
    else if (reach > 0) insights.push({ type: "warning", text: `Engagement rate ${engRate.toFixed(1)}% rendah.` });
    insights.push({ type: "neutral", text: "Skor preliminary - lengkapi WTR dan non-follower reach." });
  }
  return result(score, maximum, partial, { saveRate, shareRate, followRate, linkRate, engRate }, insights);
}

function evaluateFeed(row: ContentMetrics): ContentEvaluationResult {
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
  const engRate = reach ? (likes + comments + saves + shares) / reach * 100 : 0;
  const hasNf = present(row, "nf_pct");
  const hasLink = present(row, "link_taps");
  const partial = !(hasNf && hasLink);
  const insights: ContentInsight[] = [];
  let score = 0;
  let maximum = 35;

  if (followRate >= 1.5) { score += 35; insights.push({ type: "positive", text: `Follow rate ${followRate.toFixed(2)}% - magnet follower.` }); }
  else if (followRate >= 1) { score += 26; insights.push({ type: "positive", text: `Follow rate ${followRate.toFixed(2)}% - efektif.` }); }
  else if (followRate >= .5) { score += 15; insights.push({ type: "neutral", text: `Follow rate ${followRate.toFixed(2)}% - cukup.` }); }
  else if (reach > 0) insights.push({ type: "warning", text: "Follow rate rendah - slide terakhir kurang meyakinkan." });
  if (hasLink) {
    maximum += 25;
    if (linkRate >= 2) { score += 25; insights.push({ type: "positive", text: `Link tap rate ${linkRate.toFixed(1)}% - CTA bio maksimal.` }); }
    else if (linkRate >= 1) { score += 18; insights.push({ type: "positive", text: `Link tap rate ${linkRate.toFixed(1)}% - mendorong action.` }); }
    else if (linkRate >= .4) score += 10;
    else if (reach > 0) insights.push({ type: "warning", text: "Link tap rendah - CTA link in bio belum efektif." });
  }
  maximum += 15;
  if (saveRate >= 5) { score += 15; insights.push({ type: "positive", text: `Save rate ${saveRate.toFixed(1)}% - evergreen candidate.` }); }
  else if (saveRate >= 2) { score += 10; insights.push({ type: "positive", text: `Save rate ${saveRate.toFixed(1)}% bagus.` }); }
  else if (saveRate >= 1) score += 5;
  maximum += 10;
  if (shareRate >= 1) { score += 10; insights.push({ type: "positive", text: `Share rate ${shareRate.toFixed(1)}% - layak dibagikan.` }); }
  else if (shareRate >= .4) score += 5;
  if (hasNf) {
    maximum += 10;
    if (nfPct >= 60) { score += 10; insights.push({ type: "positive", text: `Non-follower reach ${nfPct}% - kandidat boost TOFU.` }); }
    else if (nfPct >= 40) score += 6;
    else if (nfPct > 0) score += 2;
  }
  maximum += 5;
  if (comments >= 100) { score += 5; insights.push({ type: "positive", text: `Comments ${comments} - diskusi tinggi.` }); }
  else if (comments >= 40) score += 3;
  if (partial) {
    maximum += 15;
    if (engRate >= 8) { score += 15; insights.push({ type: "positive", text: `Engagement rate ${engRate.toFixed(1)}% sangat tinggi.` }); }
    else if (engRate >= 4) { score += 10; insights.push({ type: "positive", text: `Engagement rate ${engRate.toFixed(1)}% baik.` }); }
    else if (engRate >= 2) { score += 5; insights.push({ type: "neutral", text: `Engagement rate ${engRate.toFixed(1)}% sedang.` }); }
    else if (reach > 0) insights.push({ type: "warning", text: `Engagement rate ${engRate.toFixed(1)}% rendah.` });
    insights.push({ type: "neutral", text: "Skor preliminary - lengkapi non-follower reach dan Link taps." });
  }
  return result(score, maximum, partial, { saveRate, shareRate, followRate, linkRate, engRate }, insights);
}

export function evaluateContentEvaluation(row: ContentMetrics) {
  const format = String(row.format || "").toLowerCase();
  if (format.includes("story")) return evaluateStory(row);
  if (format.includes("reel")) return evaluateReel(row);
  return evaluateFeed(row);
}

export function scoreContentEvaluation(row: ContentMetrics) {
  return evaluateContentEvaluation(row).total;
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
  let funnel: string;
  let objective: string;
  if (intent && strongSave) { funnel = "BOFU"; objective = comments >= 60 ? "Messages" : "Lead Generation"; }
  else if (strongSave || (comments >= 40 && engagementRate >= .04)) { funnel = "MOFU"; objective = "Traffic"; }
  else if ((isReel && views >= 5000) || reach >= 10000) { funnel = "TOFU"; objective = isReel && views >= 5000 ? "Video Views / ThruPlay" : "Reach"; }
  else { funnel = score >= 4 ? "MOFU" : "TOFU"; objective = score >= 6 ? "Traffic" : "Reach"; }
  return { score: Math.min(score, 10), funnel, objective, boostSignal: score >= 5 ? "high" as const : score >= 3 ? "med" as const : "low" as const };
}
