/** Kurpiyer flörtöz / seksi cümle havuzu — TTS için kısa tutuldu */

export type DealerLineKind =
  | 'deal'
  | 'win'
  | 'lose'
  | 'push'
  | 'blackjack'
  | 'turn_you'
  | 'turn_other'
  | 'dealer_play'
  | 'round_end';

const DEAL: string[] = [
  'Kartları dağıtıyorum tatlım, gözlerini benden ayırma.',
  'Hazır mısın yakışıklı? Kartlar geliyor.',
  'Şansın kadar çekicisin umarım, dağıtıyorum.',
  'Masaya biraz ateş katalım, kartlar sende.',
  'Göz göze geldik, kartları dağıtıyorum.',
  'Bol şans aşkım, kartlar uçuşuyor.',
  'İyi bak bana, sonra kartlara. Dağıtıyorum.',
  'Bu elde kalbimi de koydum masaya, dikkat et.',
  'Şimdi eğlence başlıyor, kartlar geliyor tatlı şey.',
  'Elimden çıkan her kart senin için, hazır ol.',
  'Gülümse, kartlar dağılıyor ve ben seni izliyorum.',
  'Biraz cesaret, biraz şans, biraz da ben. Dağıtıyorum.',
  'Masada yalnız değiliz, kartlar ve ben seninim.',
  'Şanslı geceler böyle başlar, kartları al.',
  'Parmaklarım kartlarda, gözlerim sende.',
  'Heyecanlanmana izin veriyorum, dağıtıyorum.',
  'Bu turda seni şaşırtacağım, kartlar geliyor.',
  'Yavaşça dağıtıyorum, tadını çıkar.',
  'Kartlar sıcak, tıpkı bakışların gibi.',
  'Şans dilersen öpücük gibi gelir, dağıtıyorum.',
  'Masaya eğilip bak, kartlar senin için.',
  'Bir nefes al tatlım, kartlar geliyor.',
  'Bu gece senin lehine çevirebilirim, belki.',
  'Kartları özenle seçiyorum, senin için.',
  'Göz kırptım, şimdi dağıtıyorum.',
  'Sessiz ol, sihir başlıyor, kartlar süzülüyor.',
  'Bu destede senin kaderin de var, al bakalım.',
  'Dudaklarımı ısırıp dağıtıyorum, hazır ol.',
  'Masaya yaklaş, kartlar fısıldıyor adını.',
  'Şans kokusu aldım üzerinde, dağıtıyorum.',
  'Bir el yeter mi, yoksa bütün gece mi? Kartlar geliyor.',
  'Işıklar sönük, kartlar parlak, sen daha parlak.',
  'Bu turda bana yakın durursan şansın artar belki.',
  'Kartları öpüp gönderiyorum, şaka şaka, dağıtıyorum.',
  'Kalp atışın hızlandı mı? Daha yeni başlıyoruz.',
];

const WIN: string[] = [
  'Kazandın tatlım, hakkettin bu gülümsemeyi.',
  'Vay canına, beni de etkiledin, kazandın.',
  'Şansın varmış, bir de bakışların. Tebrikler.',
  'Bu eli sen aldın, belki bir sonrakini de birlikte.',
  'Kazandın aşkım, masada ışıldıyorsun.',
  'Harika oynadın, kalbim biraz hızlı atıyor.',
  'Seni tebrik ederim, bu zafer çok yakıştı.',
  'Kazandın, ödül olarak bir gülümseme benden.',
  'Bu tur senin, belki sonra bir dans da olur.',
  'Şanslısın ve çekicisin, tehlikeli bir karışım.',
  'Eline sağlık tatlım, beni yendin.',
  'Kazandın, biraz daha yaklaşsana masaya.',
  'Bu zafer sıcak geldi, tıpkı senin gibi.',
  'Bravo, böyle devam edersen aklımı çelersin.',
  'Kazandın, bir sonraki elde daha yakın oynayalım.',
  'Tebrikler yakışıklı, gece senin lehine döndü.',
  'Bu eli çaldın, kalbimi de çalma sakın.',
  'Kazandın, gözlerin daha da parladi.',
  'Harikasın, bir ödül daha hak ettin.',
  'Sen kazandın, ben de izlerken keyif aldım.',
  'Zafer senin, bakışın benim ödülüm.',
  'Kazandın, fısıldayayım mı tebrikleri kulağına?',
  'Bu kadar iyi oynamak yasak olmalı, tebrikler.',
  'Masayı yıktın tatlım, ayakta alkış.',
  'Kazandın, şimdi biraz hava atmana izin var.',
];

const LOSE: string[] = [
  'Kaybettin tatlım, üzülme, ben buradayım.',
  'Bu tur benim, belki öpücükle telafi ederim.',
  'Şans yanından geçti, bakışların kalmasın.',
  'Kaybettin ama hâlâ masanın en çekici ismi sensin.',
  'Olmadı bu sefer, bir sonraki elde bana daha yakın otur.',
  'Ben kazandım, sen yine de gülümse bana.',
  'Kartlar acımasız, ben değilim, tekrar dene.',
  'Kaybettin aşkım, moralini ben düzelteyim.',
  'Bu tur gitti, sen kal, lütfen.',
  'Şansım yaver gitti, senin şansın bir sonraki elde.',
  'Üzülme, kaybetmek de bazen seksi durur.',
  'Masada yenildin, kalpte belki değil.',
  'Bu eli aldım, senin gülüşünü alamam.',
  'Kaybettin, ama o bakış hâlâ kazanıyor.',
  'Bir dahaki sefere daha şanslı ve daha yakın ol.',
  'Tur bitti, seninle oynamaya doyamadım.',
  'Bu sefer olmadı tatlı şey, vazgeçme.',
  'Ben önde bitirdim, sen hâlâ favorimsin.',
  'Kaybettin, ödülüm bir tebessüm olsun senden.',
  'Şans kapıyı çalmadı, ben çaldım, açar mısın?',
  'Bu el benim, senin sıran bir sonrakinde, söz.',
  'Kaybettin, gel yanımda moral topla.',
  'Kartlar sertti, ben yumuşakım, tekrar dene.',
  'Yenildin ama stilini kimse yenemedi.',
  'Bu tur kapandı, gülüşün açık kalsın.',
];

const PUSH: string[] = [
  'Berabere tatlım, tıpkı dans gibi, eşit adımlar.',
  'Kimse kaybetmedi, belki ikimiz de kazandık.',
  'Berabere bitti, masada gerilim tatlı duruyor.',
  'Eşitlik var, bakışlarımızda da olabilir.',
  'Berabere. Biraz daha oyna benimle.',
  'Ne sen ne ben, ama gece hâlâ sıcak.',
  'Berabere, bir sonraki elde kaderi öpelim.',
  'Denge bozulmadı, kalp atışların da mı öyle?',
  'Berabere kaldık, masadan kalkma sakın.',
  'Bu tur paylaştık, belki sırrı da paylaşırız.',
  'Eşit bitti, gerilim devam, hoşuma gitti.',
  'Berabere, remiz gibi ama daha ateşli.',
];

const BLACKJACK: string[] = [
  'Blackjack! Vay, bu kadar şık kazanılır mı?',
  'Yirmi bir, ve sen, tehlikeli bir kombinasyon.',
  'Blackjack tatlım, neredeyse aşık olacağım.',
  'Mükemmel el, mükemmel bakış, tebrikler.',
  'Blackjack! Masayı ateşe verdin.',
  'Bu el efsane, sen de öyle duruyorsun.',
  'Yirmi bir geldi, kalbim de yirmi bir attı.',
  'Blackjack aşkım, ödülün büyük olsun.',
  'İnanılmazsın, blackjack ile taçlandırdın geceyi.',
  'Bu kadar şans ve cazibe haksızlık, tebrikler.',
  'Blackjack! Öpülesi bir el oldu resmen.',
  'Yirmi bir, gece senin, belki ben de.',
];

const TURN_YOU: string[] = [
  'Sıra sende tatlım, cesur ol.',
  'Senin sıran, kart mı yoksa durmak mı? Ben bekliyorum.',
  'Gözlerini kaçırma, sıra sende.',
  'Kararını ver yakışıklı, masa senin.',
  'Sıra sende, biraz risk seksi durur.',
  'Ne yapacaksın aşkım? Kart al, ya da dur bana bak.',
  'Senin turın, heyecanı hisset.',
  'Sıra sende, parmakların titremesin.',
];

const TURN_OTHER = (name: string) => [
  `Sıra ${name} oyuncusunda, sen beni izlemeye devam et.`,
  `${name} oynuyor, sen de yanımda kal tatlım.`,
  `Şimdi ${name} düşünüyor, sen gülümse yeter.`,
  `Sıra ${name} de, merak etme seni unutmadım.`,
  `${name} kartlarıyla meşgul, ben seninle.`,
];

const DEALER_PLAY: string[] = [
  'Şimdi sıra bende, dikkatle izle.',
  'Kurpiyer oynuyor, gözlerini ayırma.',
  'Benim turum, biraz büyü bozacağım belki.',
  'Kartlarım konuşacak, sen dinle tatlım.',
  'Sıra bende, masaya biraz ateş katıyorum.',
  'Kurpiyer zamanı, şansımı dene bakayım.',
  'Ben oynuyorum, sen heyecanlanmaya devam et.',
  'Elimdeki sırlar açılıyor, izle.',
];

const ROUND_END: string[] = [
  'Tur bitti, ama gece bitmedi.',
  'Bu el kapandı, bir sonrakinde daha yakın ol.',
  'Tur sona erdi tatlım, kaçırma.',
  'Bitti bu tur, gülüşün kalsın masada.',
  'El bitti, sen hâlâ favori oyuncumsun.',
];

const recent = new Map<DealerLineKind, string[]>();
const RECENT_MAX = 8;

function remember(kind: DealerLineKind, line: string) {
  const arr = recent.get(kind) ?? [];
  arr.push(line);
  while (arr.length > RECENT_MAX) arr.shift();
  recent.set(kind, arr);
}

function pickFrom(kind: DealerLineKind, pool: string[]): string {
  if (!pool.length) return '';
  const used = new Set(recent.get(kind) ?? []);
  const fresh = pool.filter((l) => !used.has(l));
  const source = fresh.length ? fresh : pool;
  const line = source[Math.floor(Math.random() * source.length)]!;
  remember(kind, line);
  return line;
}

export function dealerLine(
  kind: DealerLineKind,
  opts?: { name?: string },
): string {
  switch (kind) {
    case 'deal':
      return pickFrom('deal', DEAL);
    case 'win':
      return pickFrom('win', WIN);
    case 'lose':
      return pickFrom('lose', LOSE);
    case 'push':
      return pickFrom('push', PUSH);
    case 'blackjack':
      return pickFrom('blackjack', BLACKJACK);
    case 'turn_you':
      return pickFrom('turn_you', TURN_YOU);
    case 'turn_other':
      return pickFrom('turn_other', TURN_OTHER(opts?.name ?? 'oyuncu'));
    case 'dealer_play':
      return pickFrom('dealer_play', DEALER_PLAY);
    case 'round_end':
      return pickFrom('round_end', ROUND_END);
    default:
      return '';
  }
}

/** Havuz büyüklüğü (test / debug) */
export function dealerLinePoolSize() {
  return (
    DEAL.length +
    WIN.length +
    LOSE.length +
    PUSH.length +
    BLACKJACK.length +
    TURN_YOU.length +
    DEALER_PLAY.length +
    ROUND_END.length +
    5 // turn_other şablonları
  );
}
