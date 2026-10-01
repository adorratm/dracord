import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni',
  description:
    '6698 sayılı KVKK kapsamında Dracord kişisel veri aydınlatma metni ve başvuru yolları.',
};

export default function KvkkLegalPage() {
  return (
    <LegalShell title="KVKK Aydınlatma Metni" updated="2026-04-01">
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) md. 10 uyarınca
        kişisel verilerinizin işlenmesine ilişkin bilgilendirme aşağıdadır.
      </p>

      <h2>1. Veri sorumlusu</h2>
      <p>
        Dracord Hizmeti işleten veri sorumlusu adına bildirimler:{' '}
        <strong>legal@dracord.com.tr</strong>.
      </p>

      <h2>2. İşlenen kişisel veri kategorileri</h2>
      <ul>
        <li>Kimlik (ad, kullanıcı adı)</li>
        <li>İletişim (e-posta)</li>
        <li>Müşteri işlem / içerik (mesaj, tepki, sunucu üyelikleri)</li>
        <li>İşlem güvenliği (IP, oturum, cihaz)</li>
        <li>Görsel ve işitsel kayıtlar (yalnızca canlı oturum iletimi; kalıcı kayıt yok)</li>
        <li>Pazarlama / analitik (isteğe bağlı, anonimleştirilmiş ölçüm)</li>
      </ul>

      <h2>3. İşleme amaçları ve hukuki sebepler</h2>
      <ul>
        <li>
          Sözleşmenin kurulması/ifası (KVKK md. 5/2-c): hesabın açılması, sohbet ve ses
          hizmetinin sunulması
        </li>
        <li>
          Meşru menfaat (md. 5/2-f): güvenlik, kötüye kullanım önleme, ürün geliştirme
        </li>
        <li>Açık rıza (md. 5/1): isteğe bağlı analitik çerezleri / pazarlama iletişimi</li>
        <li>Kanuni yükümlülük (md. 5/2-ç): saklama ve resmi talepler</li>
      </ul>

      <h2>4. Aktarım</h2>
      <p>
        Veriler, hizmet altyapısı için yurt içinde veya yeterli koruma / uygun
        güvencelerle yurt dışında (ör. bulut, RTC, OAuth sağlayıcıları) işlenebilir.
        Aktarımlarda KVKK md. 9 hükümlerine uyulur.
      </p>

      <h2>5. Saklama süresi</h2>
      <p>
        Amaç için gerekli süre + yasal zamanaşımı. Hesap silme taleplerinde içerik makul
        süre içinde silinir veya anonimleştirilir; yasal zorunluluklar saklıdır.
      </p>

      <h2>6. Haklarınız (KVKK md. 11)</h2>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
        <li>İşlenmişse buna ilişkin bilgi talep etme</li>
        <li>Amacına uygun kullanılıp kullanılmadığını öğrenme</li>
        <li>Yurt içinde/dışında aktarıldığı üçüncü kişileri bilme</li>
        <li>Eksik/yanlış işlenmişse düzeltme</li>
        <li>KVKK md. 7 kapsamında silme/yok etme</li>
        <li>Düzeltme/silmenin aktarılan üçüncü kişilere bildirilmesini isteme</li>
        <li>Otomatik sistemlerle aleyhinize sonucun ortaya çıkmasına itiraz</li>
        <li>Kanuna aykırı işlem nedeniyle zararın giderilmesini talep</li>
      </ul>

      <h2>7. Başvuru</h2>
      <p>
        Başvurularınızı <strong>legal@dracord.com.tr</strong> adresine yazılı olarak
        iletebilirsiniz. KVKK md. 13 uyarınca talepler en geç 30 gün içinde sonuçlandırılır.
        Ücretsizdir; işlemin ayrıca bir maliyet gerektirmesi halinde Kişisel Verileri
        Koruma Kurulu’nca belirlenen tarifedeki ücret uygulanabilir.
      </p>
    </LegalShell>
  );
}
