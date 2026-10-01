import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Topluluk Kuralları',
  description: 'Dracord topluluk kuralları ve moderasyon ilkeleri.',
};

export default function CommunityLegalPage() {
  return (
    <LegalShell title="Topluluk Kuralları" updated="2026-04-01">
      <p>
        Dracord zindanında herkesin güvende hissetmesi için aşağıdaki kurallar geçerlidir.
        Sunucu sahipleri ek kurallar koyabilir; platform kuralları her zaman üstündür.
      </p>

      <h2>1. Saygı</h2>
      <ul>
        <li>Taciz, tehdit, doxxing ve hedef gösterme yasaktır.</li>
        <li>Nefret söylemi ve ayrımcılık kabul edilmez.</li>
        <li>İstenmeyen DM / spam / scam paylaşımı yasaktır.</li>
      </ul>

      <h2>2. İçerik</h2>
      <ul>
        <li>Yasa dışı içerik, çocuk istismarı materyali kesinlikle yasaktır.</li>
        <li>Şiddet veya cinsel içerik yalnızca uygun kanallarda ve yaş uygunluğunda.</li>
        <li>Telif hakkı ihlali yapan medya yüklemeyin.</li>
      </ul>

      <h2>3. Teknik kötüye kullanım</h2>
      <ul>
        <li>Bot / otomasyon ile API’yi kötüye kullanmak, rate-limit aşmak yasaktır.</li>
        <li>Güvenlik açıklarını sorumlu açıklama dışında istismar etmeyin.</li>
      </ul>

      <h2>4. Ses kanalları</h2>
      <ul>
        <li>Rahatsız edici ses, müzik spam’i veya izinsiz kayıt paylaşımı yasaktır.</li>
        <li>Ekran paylaşımında kişisel / hassas veri göstermemeye özen gösterin.</li>
      </ul>

      <h2>5. Yaptırımlar</h2>
      <p>
        Uyarı, sessize alma, sunucudan uzaklaştırma, platform yasağı uygulanabilir.
        İhlal bildirimleri incelemeye alınır; tekrarlayan ihlallerde kalıcı yasak
        uygulanabilir.
      </p>
    </LegalShell>
  );
}
