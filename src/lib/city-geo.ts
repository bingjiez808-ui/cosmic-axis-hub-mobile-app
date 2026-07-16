/**
 * Curated geolocation + IANA timezone for the cities we ship in `CITIES`.
 *
 * Used by the Vedic / Ziwei calculators to convert local birth time into
 * a precise UT instant. Lookup is case-insensitive and accepts either the
 * English or Chinese form; unknown places return `null` so the snapshot
 * marks time-sensitive systems as unavailable rather than fabricating.
 */
export type CityGeo = {
  lat: number;
  lng: number;
  /** IANA timezone identifier. Used with Intl.DateTimeFormat to derive UT offset (DST-aware). */
  tz: string;
};

/** Keys are lowercase; values map both EN and ZH names to the same geo. */
const GEO: Record<string, CityGeo> = {};

function reg(names: string[], geo: CityGeo) {
  for (const n of names) GEO[n.trim().toLowerCase()] = geo;
}

// China
reg(["Beijing", "北京"], { lat: 39.9042, lng: 116.4074, tz: "Asia/Shanghai" });
reg(["Shanghai", "上海"], { lat: 31.2304, lng: 121.4737, tz: "Asia/Shanghai" });
reg(["Guangzhou", "广州"], { lat: 23.1291, lng: 113.2644, tz: "Asia/Shanghai" });
reg(["Shenzhen", "深圳"], { lat: 22.5431, lng: 114.0579, tz: "Asia/Shanghai" });
reg(["Chengdu", "成都"], { lat: 30.5728, lng: 104.0668, tz: "Asia/Shanghai" });
reg(["Hangzhou", "杭州"], { lat: 30.2741, lng: 120.1551, tz: "Asia/Shanghai" });
reg(["Nanjing", "南京"], { lat: 32.0603, lng: 118.7969, tz: "Asia/Shanghai" });
reg(["Xi'an", "Xian", "西安"], { lat: 34.3416, lng: 108.9398, tz: "Asia/Shanghai" });
reg(["Wuhan", "武汉"], { lat: 30.5928, lng: 114.3055, tz: "Asia/Shanghai" });
reg(["Chongqing", "重庆"], { lat: 29.4316, lng: 106.9123, tz: "Asia/Shanghai" });
reg(["Tianjin", "天津"], { lat: 39.3434, lng: 117.3616, tz: "Asia/Shanghai" });
reg(["Suzhou", "苏州"], { lat: 31.2989, lng: 120.5853, tz: "Asia/Shanghai" });
reg(["Qingdao", "青岛"], { lat: 36.0671, lng: 120.3826, tz: "Asia/Shanghai" });
reg(["Dalian", "大连"], { lat: 38.914, lng: 121.6147, tz: "Asia/Shanghai" });
reg(["Xiamen", "厦门"], { lat: 24.4798, lng: 118.0894, tz: "Asia/Shanghai" });
reg(["Kunming", "昆明"], { lat: 24.8801, lng: 102.8329, tz: "Asia/Shanghai" });
reg(["Changsha", "长沙"], { lat: 28.2282, lng: 112.9388, tz: "Asia/Shanghai" });
reg(["Harbin", "哈尔滨"], { lat: 45.8038, lng: 126.5349, tz: "Asia/Shanghai" });
reg(["Shenyang", "沈阳"], { lat: 41.8057, lng: 123.4315, tz: "Asia/Shanghai" });
reg(["Lhasa", "拉萨"], { lat: 29.6520, lng: 91.1721, tz: "Asia/Shanghai" });
reg(["Hong Kong", "香港"], { lat: 22.3193, lng: 114.1694, tz: "Asia/Hong_Kong" });
reg(["Macau", "澳门"], { lat: 22.1987, lng: 113.5439, tz: "Asia/Macau" });
// Taiwan
reg(["Taipei", "台北"], { lat: 25.033, lng: 121.5654, tz: "Asia/Taipei" });
reg(["Kaohsiung", "高雄"], { lat: 22.6273, lng: 120.3014, tz: "Asia/Taipei" });
// Japan
reg(["Tokyo", "东京"], { lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo" });
reg(["Osaka", "大阪"], { lat: 34.6937, lng: 135.5023, tz: "Asia/Tokyo" });
reg(["Kyoto", "京都"], { lat: 35.0116, lng: 135.7681, tz: "Asia/Tokyo" });
reg(["Sapporo", "札幌"], { lat: 43.0621, lng: 141.3544, tz: "Asia/Tokyo" });
reg(["Fukuoka", "福冈"], { lat: 33.5904, lng: 130.4017, tz: "Asia/Tokyo" });
// Korea
reg(["Seoul", "首尔"], { lat: 37.5665, lng: 126.978, tz: "Asia/Seoul" });
reg(["Busan", "釜山"], { lat: 35.1796, lng: 129.0756, tz: "Asia/Seoul" });
// SE Asia
reg(["Singapore", "新加坡"], { lat: 1.3521, lng: 103.8198, tz: "Asia/Singapore" });
reg(["Kuala Lumpur", "吉隆坡"], { lat: 3.139, lng: 101.6869, tz: "Asia/Kuala_Lumpur" });
reg(["Bangkok", "曼谷"], { lat: 13.7563, lng: 100.5018, tz: "Asia/Bangkok" });
reg(["Jakarta", "雅加达"], { lat: -6.2088, lng: 106.8456, tz: "Asia/Jakarta" });
reg(["Manila", "马尼拉"], { lat: 14.5995, lng: 120.9842, tz: "Asia/Manila" });
reg(["Hanoi", "河内"], { lat: 21.0285, lng: 105.8542, tz: "Asia/Ho_Chi_Minh" });
reg(["Ho Chi Minh City", "胡志明市"], { lat: 10.8231, lng: 106.6297, tz: "Asia/Ho_Chi_Minh" });
// India / South Asia
reg(["Mumbai", "孟买"], { lat: 19.076, lng: 72.8777, tz: "Asia/Kolkata" });
reg(["Delhi", "德里"], { lat: 28.7041, lng: 77.1025, tz: "Asia/Kolkata" });
reg(["Bengaluru", "Bangalore", "班加罗尔"], { lat: 12.9716, lng: 77.5946, tz: "Asia/Kolkata" });
reg(["Chennai", "钦奈"], { lat: 13.0827, lng: 80.2707, tz: "Asia/Kolkata" });
reg(["Kolkata", "加尔各答"], { lat: 22.5726, lng: 88.3639, tz: "Asia/Kolkata" });
reg(["Hyderabad", "海得拉巴"], { lat: 17.385, lng: 78.4867, tz: "Asia/Kolkata" });
reg(["Karachi", "卡拉奇"], { lat: 24.8607, lng: 67.0011, tz: "Asia/Karachi" });
reg(["Dhaka", "达卡"], { lat: 23.8103, lng: 90.4125, tz: "Asia/Dhaka" });
reg(["Colombo", "科伦坡"], { lat: 6.9271, lng: 79.8612, tz: "Asia/Colombo" });
reg(["Kathmandu", "加德满都"], { lat: 27.7172, lng: 85.324, tz: "Asia/Kathmandu" });
// Middle East
reg(["Dubai", "迪拜"], { lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" });
reg(["Abu Dhabi", "阿布扎比"], { lat: 24.4539, lng: 54.3773, tz: "Asia/Dubai" });
reg(["Riyadh", "利雅得"], { lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh" });
reg(["Tehran", "德黑兰"], { lat: 35.6892, lng: 51.389, tz: "Asia/Tehran" });
reg(["Istanbul", "伊斯坦布尔"], { lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul" });
reg(["Jerusalem", "耶路撒冷"], { lat: 31.7683, lng: 35.2137, tz: "Asia/Jerusalem" });
reg(["Tel Aviv", "特拉维夫"], { lat: 32.0853, lng: 34.7818, tz: "Asia/Jerusalem" });
// Africa
reg(["Cairo", "开罗"], { lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" });
reg(["Nairobi", "内罗毕"], { lat: -1.2921, lng: 36.8219, tz: "Africa/Nairobi" });
reg(["Lagos", "拉各斯"], { lat: 6.5244, lng: 3.3792, tz: "Africa/Lagos" });
reg(["Johannesburg", "约翰内斯堡"], { lat: -26.2041, lng: 28.0473, tz: "Africa/Johannesburg" });
reg(["Cape Town", "开普敦"], { lat: -33.9249, lng: 18.4241, tz: "Africa/Johannesburg" });
reg(["Casablanca", "卡萨布兰卡"], { lat: 33.5731, lng: -7.5898, tz: "Africa/Casablanca" });
// Europe
reg(["Athens", "雅典"], { lat: 37.9838, lng: 23.7275, tz: "Europe/Athens" });
reg(["Rome", "罗马"], { lat: 41.9028, lng: 12.4964, tz: "Europe/Rome" });
reg(["Milan", "米兰"], { lat: 45.4642, lng: 9.19, tz: "Europe/Rome" });
reg(["Venice", "威尼斯"], { lat: 45.4408, lng: 12.3155, tz: "Europe/Rome" });
reg(["Madrid", "马德里"], { lat: 40.4168, lng: -3.7038, tz: "Europe/Madrid" });
reg(["Barcelona", "巴塞罗那"], { lat: 41.3851, lng: 2.1734, tz: "Europe/Madrid" });
reg(["Lisbon", "里斯本"], { lat: 38.7223, lng: -9.1393, tz: "Europe/Lisbon" });
reg(["Paris", "巴黎"], { lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" });
reg(["Lyon", "里昂"], { lat: 45.764, lng: 4.8357, tz: "Europe/Paris" });
reg(["London", "伦敦"], { lat: 51.5074, lng: -0.1278, tz: "Europe/London" });
reg(["Manchester", "曼彻斯特"], { lat: 53.4808, lng: -2.2426, tz: "Europe/London" });
reg(["Edinburgh", "爱丁堡"], { lat: 55.9533, lng: -3.1883, tz: "Europe/London" });
reg(["Dublin", "都柏林"], { lat: 53.3498, lng: -6.2603, tz: "Europe/Dublin" });
reg(["Amsterdam", "阿姆斯特丹"], { lat: 52.3676, lng: 4.9041, tz: "Europe/Amsterdam" });
reg(["Berlin", "柏林"], { lat: 52.52, lng: 13.405, tz: "Europe/Berlin" });
reg(["Munich", "慕尼黑"], { lat: 48.1351, lng: 11.582, tz: "Europe/Berlin" });
reg(["Hamburg", "汉堡"], { lat: 53.5511, lng: 9.9937, tz: "Europe/Berlin" });
reg(["Frankfurt", "法兰克福"], { lat: 50.1109, lng: 8.6821, tz: "Europe/Berlin" });
reg(["Zurich", "苏黎世"], { lat: 47.3769, lng: 8.5417, tz: "Europe/Zurich" });
reg(["Vienna", "维也纳"], { lat: 48.2082, lng: 16.3738, tz: "Europe/Vienna" });
reg(["Prague", "布拉格"], { lat: 50.0755, lng: 14.4378, tz: "Europe/Prague" });
reg(["Warsaw", "华沙"], { lat: 52.2297, lng: 21.0122, tz: "Europe/Warsaw" });
reg(["Budapest", "布达佩斯"], { lat: 47.4979, lng: 19.0402, tz: "Europe/Budapest" });
reg(["Stockholm", "斯德哥尔摩"], { lat: 59.3293, lng: 18.0686, tz: "Europe/Stockholm" });
reg(["Oslo", "奥斯陆"], { lat: 59.9139, lng: 10.7522, tz: "Europe/Oslo" });
reg(["Copenhagen", "哥本哈根"], { lat: 55.6761, lng: 12.5683, tz: "Europe/Copenhagen" });
reg(["Helsinki", "赫尔辛基"], { lat: 60.1699, lng: 24.9384, tz: "Europe/Helsinki" });
reg(["Moscow", "莫斯科"], { lat: 55.7558, lng: 37.6173, tz: "Europe/Moscow" });
reg(["Saint Petersburg", "圣彼得堡"], { lat: 59.9311, lng: 30.3609, tz: "Europe/Moscow" });
// Americas
reg(["New York", "纽约"], { lat: 40.7128, lng: -74.006, tz: "America/New_York" });
reg(["Boston", "波士顿"], { lat: 42.3601, lng: -71.0589, tz: "America/New_York" });
reg(["Washington", "Washington DC", "华盛顿"], { lat: 38.9072, lng: -77.0369, tz: "America/New_York" });
reg(["Miami", "迈阿密"], { lat: 25.7617, lng: -80.1918, tz: "America/New_York" });
reg(["Toronto", "多伦多"], { lat: 43.6532, lng: -79.3832, tz: "America/Toronto" });
reg(["Montreal", "蒙特利尔"], { lat: 45.5017, lng: -73.5673, tz: "America/Toronto" });
reg(["Chicago", "芝加哥"], { lat: 41.8781, lng: -87.6298, tz: "America/Chicago" });
reg(["Houston", "休斯顿"], { lat: 29.7604, lng: -95.3698, tz: "America/Chicago" });
reg(["Dallas", "达拉斯"], { lat: 32.7767, lng: -96.797, tz: "America/Chicago" });
reg(["Denver", "丹佛"], { lat: 39.7392, lng: -104.9903, tz: "America/Denver" });
reg(["Los Angeles", "洛杉矶"], { lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles" });
reg(["San Francisco", "旧金山"], { lat: 37.7749, lng: -122.4194, tz: "America/Los_Angeles" });
reg(["Seattle", "西雅图"], { lat: 47.6062, lng: -122.3321, tz: "America/Los_Angeles" });
reg(["Vancouver", "温哥华"], { lat: 49.2827, lng: -123.1207, tz: "America/Vancouver" });
reg(["Honolulu", "檀香山"], { lat: 21.3069, lng: -157.8583, tz: "Pacific/Honolulu" });
reg(["Mexico City", "墨西哥城"], { lat: 19.4326, lng: -99.1332, tz: "America/Mexico_City" });
reg(["Sao Paulo", "São Paulo", "圣保罗"], { lat: -23.5505, lng: -46.6333, tz: "America/Sao_Paulo" });
reg(["Rio de Janeiro", "里约热内卢"], { lat: -22.9068, lng: -43.1729, tz: "America/Sao_Paulo" });
reg(["Buenos Aires", "布宜诺斯艾利斯"], { lat: -34.6037, lng: -58.3816, tz: "America/Argentina/Buenos_Aires" });
reg(["Santiago", "圣地亚哥"], { lat: -33.4489, lng: -70.6693, tz: "America/Santiago" });
reg(["Lima", "利马"], { lat: -12.0464, lng: -77.0428, tz: "America/Lima" });
reg(["Bogota", "Bogotá", "波哥大"], { lat: 4.711, lng: -74.0721, tz: "America/Bogota" });
// Oceania
reg(["Sydney", "悉尼"], { lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney" });
reg(["Melbourne", "墨尔本"], { lat: -37.8136, lng: 144.9631, tz: "Australia/Melbourne" });
reg(["Brisbane", "布里斯班"], { lat: -27.4698, lng: 153.0251, tz: "Australia/Brisbane" });
reg(["Perth", "珀斯"], { lat: -31.9505, lng: 115.8605, tz: "Australia/Perth" });
reg(["Auckland", "奥克兰"], { lat: -36.8485, lng: 174.7633, tz: "Pacific/Auckland" });

export function lookupCityGeo(place: string | null | undefined): CityGeo | null {
  if (!place) return null;
  const key = place.trim().toLowerCase();
  if (!key) return null;
  if (GEO[key]) return GEO[key];
  // "City, Country" — try the first segment.
  const head = key.split(/[,，、·]/)[0]?.trim();
  if (head && GEO[head]) return GEO[head];
  return null;
}

/**
 * Local (naive) birth time in a given IANA tz → true UT instant, DST-aware.
 * Uses Intl.DateTimeFormat to determine that tz's offset at the candidate
 * UTC instant, then iterates once to handle the offset-difference edge case
 * (DST fall-back / spring-forward ambiguity is resolved to the "first" pass).
 */
export function localBirthToUTC(
  dateISO: string,
  timeHM: string | null | undefined,
  tz: string,
): Date | null {
  const dm = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const [, ys, mos, ds] = dm;
  let hh = 12, mm = 0; // if no time, default noon to keep planets stable
  if (timeHM) {
    const tm = timeHM.match(/^(\d{1,2}):(\d{2})$/);
    if (!tm) return null;
    hh = +tm[1]; mm = +tm[2];
    if (hh > 23 || mm > 59) return null;
  }
  const y = +ys, mo = +mos, d = +ds;
  // First guess: treat as UTC.
  const guess = Date.UTC(y, mo - 1, d, hh, mm, 0);
  const offsetMin = tzOffsetMinutes(tz, new Date(guess));
  const utcMs = guess - offsetMin * 60_000;
  // Verify: the local rendering of that utcMs in tz matches inputs.
  const check = tzOffsetMinutes(tz, new Date(utcMs));
  const finalMs = check === offsetMin ? utcMs : guess - check * 60_000;
  return new Date(finalMs);
}

/** Positive minutes east of UTC. */
function tzOffsetMinutes(tz: string, atUtc: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(atUtc).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour, +parts.minute, +parts.second,
  );
  return Math.round((asUtc - atUtc.getTime()) / 60_000);
}
