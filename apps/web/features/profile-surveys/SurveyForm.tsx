'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { schemaToZod } from '@binaryiq/types';
import type { CategorySchema } from '@binaryiq/types';
import { FormField, Input, Select, RadioGroup, MultiSelect, Button, Alert } from '@binaryiq/ui';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { POINTS_ENABLED } from '@/features/flags';
import { ApiError } from '@/lib/api/client';

interface SurveyFormProps {
  schema: CategorySchema;
  defaults?: Record<string, unknown>;
  onSubmit: (answers: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
}

export function SurveyForm({ schema, defaults, onSubmit, readOnly = false }: SurveyFormProps): React.JSX.Element {
  const zodSchema = schemaToZod(schema);
  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: defaults ?? {},
  });

  const submit = handleSubmit(async (values) => {
    setRootError(null);
    try {
      await onSubmit(values as Record<string, unknown>);
    } catch (err) {
      setRootError(err instanceof ApiError ? err.message : 'Submission failed. Try again.');
    }
  });

  if (readOnly && defaults) {
    return (
      <div className="flex flex-col gap-3">
        {schema.questions.map((q) => (
          <div key={q.key} className="text-sm">
            <span className="text-secondary font-medium">{q.label}: </span>
            <span className="text-text">{Array.isArray(defaults[q.key]) ? (defaults[q.key] as string[]).join(', ') : String(defaults[q.key] ?? '—')}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {rootError && <Alert variant="error">{rootError}</Alert>}
      {schema.questions.map((q) => {
        const err = (errors as Record<string, { message?: string }>)[q.key]?.message;
        if (q.type === 'select') {
          return (
            <FormField key={q.key} label={q.label} error={err} required={q.required}>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  options={q.options ?? []}
                  placeholder="Select…"
                  {...register(q.key)}
                />
              )}
            </FormField>
          );
        }
        if (q.type === 'radio') {
          return (
            <FormField key={q.key} label={q.label} error={err} required={q.required}>
              {({ invalid }) => (
                <Controller
                  name={q.key}
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      name={q.key}
                      options={q.options ?? []}
                      value={field.value as string}
                      onChange={field.onChange}
                      invalid={invalid}
                    />
                  )}
                />
              )}
            </FormField>
          );
        }
        if (q.type === 'multiselect') {
          return (
            <FormField key={q.key} label={q.label} error={err} required={q.required}>
              {({ invalid }) => (
                <Controller
                  name={q.key}
                  control={control}
                  render={({ field }) => (
                    <MultiSelect
                      name={q.key}
                      options={q.options ?? []}
                      value={field.value as string[]}
                      onChange={field.onChange}
                      maxSelections={q.maxSelections}
                      invalid={invalid}
                    />
                  )}
                />
              )}
            </FormField>
          );
        }
        return (
          <FormField key={q.key} label={q.label} error={err} required={q.required}>
            {({ id, invalid }) => (
              <Input
                id={id}
                type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'}
                invalid={invalid}
                {...register(q.key, q.type === 'number' ? { valueAsNumber: true } : {})}
              />
            )}
          </FormField>
        );
      })}
      <Button type="submit" loading={isSubmitting} fullWidth>
        {POINTS_ENABLED ? <>Submit &amp; earn {schema.questions.length > 0 ? 'points' : ''}</> : 'Submit'}
      </Button>
    </form>
  );
}
