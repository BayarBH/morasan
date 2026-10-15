// Fictional members of 「ミライカーシェア（架空）」. Deterministic: seeded PRNG, no Math.random.
import type { Member } from '../core/schemas';

export const CANARY_IDS = ['M-000121', 'M-000222', 'M-000290'] as const;
const FORCE_ACTIVE = new Set<string>([...CANARY_IDS, 'M-000045', 'M-000123']);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FAMILY = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '松本', '井上', '木村', '林', '清水', '森', '池田'];
const GIVEN = ['陽菜', '蓮', '結衣', '湊', '葵', '大翔', '凛', '悠真', '美咲', '颯太', '花子', '太郎', '彩', '健一', '真由', '翔', '由紀', '拓海', '奈々', '誠'];
const ROMAJI = ['sato', 'suzuki', 'takahashi', 'tanaka', 'ito', 'watanabe', 'yamamoto', 'nakamura', 'kobayashi', 'kato', 'yoshida', 'yamada', 'sasaki', 'matsumoto', 'inoue', 'kimura', 'hayashi', 'shimizu', 'mori', 'ikeda'];
const DOMAINS = ['example.jp', 'example.co.jp', 'example.ne.jp'];
const CITIES = ['みらい市', 'さくら台市', 'あおば町', 'ひかり市', 'つばさ区', 'ほしぞら町'];
const TOWNS = ['桜ヶ丘', '若葉', '星見台', '緑町', '港南', '風見'];
const STATIONS = ['みらい駅前ステーション', 'さくら台中央ステーション', 'あおば公園ステーション', 'ひかり港ステーション', 'つばさ大通りステーション'];

const pad = (n: number, w: number) => String(n).padStart(w, '0');

function generate(): Member[] {
  const rnd = mulberry32(20261015);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const out: Member[] = [];
  for (let n = 1; n <= 300; n++) {
    const memberId = `M-${pad(n, 6)}`;
    const fi = int(0, FAMILY.length - 1);
    // First 120 rows: exactly 20 withdrawn (n % 6 === 4), so the first 100 active rows end at M-000120 and
    // never touch canary M-000121. After that ~22% withdrawn → ≈20% overall.
    const withdrawn = !FORCE_ACTIVE.has(memberId) && (n <= 120 ? n % 6 === 4 : rnd() < 0.22);
    const uses = int(0, 4);
    out.push({
      memberId,
      name: `${FAMILY[fi]} ${pick(GIVEN)}`,
      email: `${ROMAJI[fi]}.${pad(n, 4)}@${pick(DOMAINS)}`,
      phone: `090-0000-${pad(int(0, 9999), 4)}`,
      address: `架空県${pick(CITIES)}${pick(TOWNS)}${int(1, 5)}丁目${int(1, 30)}-${int(1, 20)}`,
      birthDate: `${int(1950, 2004)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
      licenseNumber: `99${pad(int(0, 9999999999), 10)}`,
      licenseImage: `license-img://${memberId}`,
      paymentLast4: pad(int(0, 9999), 4),
      usageHistory: Array.from({ length: uses }, () => ({
        date: `2026-${pad(int(1, 9), 2)}-${pad(int(1, 28), 2)}`,
        station: pick(STATIONS),
        minutes: int(2, 48) * 15,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      status: withdrawn ? 'withdrawn' : 'active',
      withdrawnAt: withdrawn ? `2025-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}T00:00:00+09:00` : null,
      canary: (CANARY_IDS as readonly string[]).includes(memberId),
    });
  }
  return out;
}

export const MEMBERS: Member[] = generate();
const BY_ID = new Map(MEMBERS.map((m) => [m.memberId, m]));
export const getMember = (id: string): Member | undefined => BY_ID.get(id);
