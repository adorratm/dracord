import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası',
  description:
    'Dracord gizlilik politikası: hangi verileri işlediğimiz, saklama süreleri ve haklarınız.',
};

export default function PrivacyLegalPage() {
  return (
    <LegalShell title="Gizlilik Politikası" updated="2026-04-01">
      <p>
        Bu metin, Dracord (“Hizmet”) kapsamında kişisel verilerinizin nasıl toplandığını,
        işlendiğini ve korunduğunu açıklar. Hizmet’i kullanarak bu politikayı kabul etmiş
        sayılırsınız.
      </p>

      <h2>1. Veri sorumlusu</h2>
      <p>
        Dracord platformunu işleten ekip, Türkiye’de sunulan hizmetler için KVKK kapsamında
        veri sorumlusudur. İletişim: <strong>legal@dracord.com.tr</strong>.
      </p>

      <h2>2. Topladığımız veriler</h2>
      <ul>
        <li>
          <strong>Hesap:</strong> Google OAuth veya geliştirici girişi ile gelen kimlik,
          e-posta, görünen ad, kullanıcı adı, avatar.
        </li>
        <li>
          <strong>Profil:</strong> bio, banner, sosyal bağlantılar, özel durum metni,
          tercih ettiğiniz presence (çevrimiçi / uzakta / rahatsız etmeyin).
        </li>
        <li>
          <strong>İçerik:</strong> metin mesajları, ekler, tepkiler, anketler, sabitlenen
          mesajlar, DM’ler.
        </li>
        <li>
          <strong>Ses / medya:</strong> LiveKit üzerinden ses-görüntü oturum meta verisi
          (kanal kimliği, sessiz/kulaklık durumu); medya akışları uçtan uca oturum
          süresince iletilir, kalıcı olarak saklanmaz.
        </li>
        <li>
          <strong>Müzik:</strong> kuyruk, çalınan parça başlığı/URL, isteyen kullanıcı,
          ses seviyesi tercihleri (yerel depolama dahil).
        </li>
        <li>
          <strong>Teknik:</strong> IP (güvenlik / hız sınırlama), cihaz bilgisi, oturum
          jetonları, hata günlükleri, isteğe bağlı analitik (GA4 — IP anonimleştirme ile).
        </li>
        <li>
          <strong>Tercihler:</strong> bildirim, gizlilik, görünüm ve erişilebilirlik
          ayarları.
        </li>
      </ul>

      <h2>3. Amaçlar</h2>
      <ul>
        <li>Hizmeti sunmak (sohbet, ses, sunucu/rol yönetimi, arkadaşlık, bildirimler)</li>
        <li>Güvenlik, kötüye kullanım ve spam önleme</li>
        <li>Ürün iyileştirme ve performans ölçümü (anonimleştirilmiş analitik)</li>
        <li>Yasal yükümlülüklere uyum</li>
      </ul>

      <h2>4. Paylaşım</h2>
      <p>
        Verilerinizi satmayız. Altyapı sağlayıcıları (barındırma, LiveKit, Google OAuth,
        e-posta/analiz) yalnızca hizmetin çalışması için gerekli ölçüde erişebilir. Mahkeme
        kararı veya yasal zorunluluk halinde sınırlı açıklama yapılabilir.
      </p>

      <h2>5. Saklama</h2>
      <p>
        Hesap silinene veya siz silme talep edene kadar hesap ve mesaj verileri tutulur.
        Yedekler makul sürelerle döner. Ses/kamera akışları oturum sonrası kalıcı
        depolanmaz. Yerel tercihler tarayıcınızda saklanabilir.
      </p>

      <h2>6. Haklarınız</h2>
      <p>
        KVKK kapsamında bilme, düzeltme, silme, itiraz ve veri taşınabilirliği haklarınız
        vardır. Ayarlar → Veri ve Gizlilik üzerinden birçok tercihi yönetebilir; silme
        talepleri için <strong>legal@dracord.com.tr</strong> adresine yazabilirsiniz.
        Ayrıntılar için <a className="text-[#bd93f9] underline" href="/legal/kvkk">KVKK Aydınlatma Metni</a>.
      </p>

      <h2>7. Çocuklar</h2>
      <p>
        Hizmet 16 yaş altı kullanıcılar için tasarlanmamıştır. Yaş doğrulaması
        uygulanabilir; tespit edilirse hesap kısıtlanabilir.
      </p>

      <h2>8. Değişiklikler</h2>
      <p>
        Bu politika güncellenebilir. Önemli değişikliklerde uygulama içi bildirim veya
        e-posta ile haber verilir. Güncel sürüm her zaman bu sayfada yayınlanır.
      </p>
    </LegalShell>
  );
}
