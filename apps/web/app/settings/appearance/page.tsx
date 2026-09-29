'use client';

export default function AppearanceSettingsPage() {
  return (
    <div className="max-w-2xl px-space-xl py-space-xl space-y-space-lg">
      <section>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-space-sm">Görünüm</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
          Dracord varsayılan olarak koyu Dracula temasını kullanır.
        </p>
        <div className="rounded-xl bg-surface-container-low p-space-lg space-y-space-md">
          <label className="flex items-center justify-between gap-space-md">
            <span className="font-body-md text-body-md">Tema</span>
            <select
              className="bg-surface-container-high rounded-lg px-space-md py-space-sm text-on-surface font-body-sm"
              defaultValue="dark"
              disabled
            >
              <option value="dark">Koyu (Dracula)</option>
            </select>
          </label>
          <p className="font-body-sm text-body-sm text-outline">
            Açık tema ve özel vurgu renkleri yakında eklenecek.
          </p>
        </div>
      </section>
    </div>
  );
}
