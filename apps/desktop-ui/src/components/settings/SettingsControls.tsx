import type { ReactNode } from 'react';
import { cn, SearchableSelectField } from '@dracord/ui';

export function SettingsPageBody({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-2xl w-full min-w-0 space-y-space-md sm:space-y-space-lg">
      <header className="min-w-0">
        <h2 className="font-headline-lg text-xl sm:text-headline-lg text-on-surface break-words">
          {title}
        </h2>
        {description && (
          <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
            {description}
          </p>
        )}
      </header>
      {children}
    </div>
  );
}

export function SettingsSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-space-sm', className)}>
      {title && (
        <h3 className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
          {title}
        </h3>
      )}
      <div className="rounded-xl bg-surface-container-low divide-y divide-surface-container-high overflow-hidden">
        {children}
      </div>
    </section>
  );
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex items-start justify-between gap-space-sm sm:gap-space-md px-space-md py-space-md cursor-pointer min-w-0',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-body-md text-on-surface">{label}</p>
        {description && (
          <p className="font-body-sm text-on-surface-variant mt-1">{description}</p>
        )}
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-primary-container shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function SettingsSelect({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <SearchableSelectField
      label={label}
      description={description}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function SettingsNote({ children }: { children: ReactNode }) {
  return (
    <p className="px-space-md py-space-md font-body-sm text-on-surface-variant">{children}</p>
  );
}

export function SettingsSlider({
  label,
  description,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled,
  suffix,
}: {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <label
      className={`flex flex-col gap-space-sm px-space-md py-space-md min-w-0 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-space-sm">
        <div className="min-w-0 flex-1">
          <p className="font-body-md text-on-surface">{label}</p>
          {description && (
            <p className="font-body-sm text-on-surface-variant mt-1">{description}</p>
          )}
        </div>
        <span className="shrink-0 font-label-sm tabular-nums text-outline">
          {Math.round(value)}
          {suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-primary-container"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
