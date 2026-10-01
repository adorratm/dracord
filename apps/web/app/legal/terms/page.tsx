import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Hizmet Koşulları',
  description: 'Dracord kullanım koşulları, kabul edilebilir kullanım ve sorumluluk sınırları.',
};

export default function TermsLegalPage() {
  return (
    <LegalShell title="Hizmet Koşulları" updated="2026-04-01">
      <p>
        Dracord’a erişerek veya hesap oluşturarak bu Hizmet Koşulları’nı kabul edersiniz.
        Kabul etmiyorsanız Hizmet’i kullanmayın.
      </p>

      <h2>1. Hizmetin tanımı</h2>
      <p>
        Dracord; metin kanalları, sesli odalar (kamera / ekran paylaşımı), müzik botu,
        sunucu/rol yönetimi, arkadaşlık ve DM özelliklerini sunan bir topluluk sohbet
        platformudur. Özellikler “olduğu gibi” sunulur ve önceden haber verilerek
        değiştirilebilir, askıya alınabilir veya kaldırılabilir.
      </p>

      <h2>2. Hesap</h2>
      <ul>
        <li>Doğru bilgi vermek ve oturum güvenliğinden sorumlu olmak sizin yükümlülüğünüzdür.</li>
        <li>Hesabınızı başkasına devredemezsiniz.</li>
        <li>Şüpheli etkinlikte hesabı askıya alma veya silme hakkımız saklıdır.</li>
      </ul>

      <h2>3. Kabul edilebilir kullanım</h2>
      <ul>
        <li>Taciz, nefret söylemi, tehdit, yasa dışı içerik ve spam yasaktır.</li>
        <li>Başkalarının hesaplarına yetkisiz erişim, exploit veya servis kesintisi yasaktır.</li>
        <li>Telif hakkı ihlali içeren medya yüklemek veya yayınlamak yasaktır.</li>
        <li>Müzik botu yalnızca yasal kaynaklarla ve kişisel/topluluk dinleme amacıyla kullanılmalıdır.</li>
        <li>
          Ayrıntılı davranış kuralları:{' '}
          <a className="text-[#bd93f9] underline" href="/legal/community">
            Topluluk Kuralları
          </a>
          .
        </li>
      </ul>

      <h2>4. İçerik ve lisans</h2>
      <p>
        Yüklediğiniz içerik size aittir. Hizmeti işletmek için bize dünya çapında,
        münhasır olmayan, telifsiz bir lisans verirsiniz (barındırma, iletim, önizleme).
        Sunucu sahipleri kendi sunucularındaki moderasyon kurallarını uygular; biz
        platform geneli ihlallerde müdahale edebiliriz.
      </p>

      <h2>5. Ses, ekran ve müzik</h2>
      <p>
        Ses/görüntü üçüncü taraf RTC altyapısı üzerinden iletilir. Bağlantı kalitesi
        ağınıza bağlıdır. Müzik kuyruğu ve çalma durumu sunucuda işlenir; üçüncü taraf
        video/müzik platformlarının kendi koşullarına da uymanız gerekir.
      </p>

      <h2>6. Ücretli özellikler</h2>
      <p>
        Nitro veya benzeri ücretli katmanlar sunulursa ayrı faturalandırma koşulları
        uygulanır. Deneme veya beta özellikler ücretsiz olabilir ve değişebilir.
      </p>

      <h2>7. Sorumluluk reddi</h2>
      <p>
        Hizmet kesintisiz veya hatasız garanti edilmez. Dolaylı, arızi veya kar kaybı
        zararlarından yasal olarak izin verilen azami ölçüde sorumlu değiliz.
      </p>

      <h2>8. Fesih</h2>
      <p>
        İstediğiniz zaman hesabınızı kapatabilirsiniz. Koşulları ihlal ederseniz erişimi
        derhal sonlandırabiliriz. Fesih sonrası bazı yasal saklama yükümlülükleri devam
        edebilir.
      </p>

      <h2>9. Uygulanacak hukuk</h2>
      <p>
        Türkiye Cumhuriyeti kanunları uygulanır. Uyuşmazlıklarda İstanbul mahkemeleri
        yetkilidir (tüketici hakları saklıdır).
      </p>
    </LegalShell>
  );
}
