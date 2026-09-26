'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';
import { cn } from '@/lib/utils';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'email' | 'select' | 'textarea' | 'checkbox' | 'password';
  options?: { value: string | number; label: string }[];
  required?: boolean;
  full?: boolean;
  placeholder?: string;
  hint?: string;
  show?: (values: Record<string, any>) => boolean;
}

/** Modal form generik untuk create/update data master. */
export function FormModal({ open, onClose, title, fields, initial, onSubmit, submitLabel = 'Simpan', size = 'lg' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FieldDef[];
  initial?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<unknown> | unknown;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setValues(initial || {});
  }, [open, initial]);

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const out: Record<string, any> = { ...values };
      for (const f of fields) {
        if (f.type === 'number' || (f.type === 'select' && f.options?.length && typeof f.options[0].value === 'number')) {
          out[f.name] = out[f.name] === '' || out[f.name] === undefined || out[f.name] === null ? null : Number(out[f.name]);
        }
        if (f.type === 'checkbox') out[f.name] = !!out[f.name];
      }
      await onSubmit(out);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={() => submit()} loading={busy}>{submitLabel}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.filter((f) => !f.show || f.show(values)).map((f) => (
          <Field key={f.name} label={f.label} required={f.required} hint={f.hint} className={cn((f.full || f.type === 'textarea') && 'sm:col-span-2')}>
            {f.type === 'select' ? (
              <Select value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} options={f.options || []} placeholder={f.placeholder ?? '- Pilih -'} required={f.required} />
            ) : f.type === 'textarea' ? (
              <Textarea value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} rows={4} />
            ) : f.type === 'checkbox' ? (
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
            ) : (
              <Input type={f.type || 'text'} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} required={f.required} />
            )}
          </Field>
        ))}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
