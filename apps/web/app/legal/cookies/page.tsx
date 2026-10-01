import type { Metadata } from 'next';
import { LegalShell } from '@/components/LegalShell';

export const metadata: Metadata = {
  title: 'Çerez Politikası',
  description: 'Dracord çerez ve benzeri teknolojiler politikası.',
};

export default function CookiesLegalPage() {
  return (
    <LegalShell title="Çerez Politikası" updated="2026-04-01">
      <p>
        Dracord, oturum yönetimi, güvenlik ve (açık rıza ile) analitik için çerezler ve
        benzeri depolama teknolojileri kullanır.
      </p>

      <h2>1. Zorunlu çerezler / depolama</h2>
      <ul>
        <li>Oturum jetonları (access / refresh) — girişin sürmesi için</li>
        <li>Tercihler (tema, müzik çubuğu boyutu, ses seviyeleri) — localStorage</li>
        <li>CSRF / güvenlik önlemleri</li>
      </ul>

      <h2>2. Analitik</h2>
      <p>
        <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> tanımlıysa Google Analytics 4 yüklenir;
        IP anonimleştirme açıktır. Bu ölçüm ürün kullanımını anlamamıza yardımcı olur.
        Tarayıcı ayarlarından veya eklentilerle kısıtlanabilir.
      </p>

      <h2>3. Üçüncü taraflar</h2>
      <p>
        Google OAuth, LiveKit ve barındırma sağlayıcıları kendi çerez politikalarına
        tabidir. Bu siteleri ziyaret ettiğinizde onların koşulları da uygulanır.
      </p>

      <h2>4. Yönetim</h2>
      <p>
        Tarayıcınızdan çerezleri silebilir veya engelleyebilirsiniz; zorunlu çerezler
        olmadan giriş çalışmayabilir. Daha fazla bilgi:{' '}
        <a className="text-[#bd93f9] underline" href="/legal/privacy">
          Gizlilik Politikası
        </a>
        .
      </p>
    </LegalShell>
  );
}
