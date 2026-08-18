'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updateAboutYouSchema, type UpdateAboutYouInput } from '@influencer/types';
import { FormField, Input, Select, Button, Alert } from '@influencer/ui';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { accountApi } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';

const EDUCATION = [
  { value: 'secondary', label: 'Secondary' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'postgrad', label: 'Post-graduate' },
  { value: 'other', label: 'Other' },
];

const EMPLOYMENT = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'student', label: 'Student' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'retired', label: 'Retired' },
  { value: 'unemployed', label: 'Unemployed' },
];

const AREA = [
  { value: 'URBAN', label: 'Urban' },
  { value: 'RURAL', label: 'Rural' },
  { value: 'SUBURBAN', label: 'Suburban' },
];

export default function AboutYouTab(): React.JSX.Element {
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<UpdateAboutYouInput>({ resolver: zodResolver(updateAboutYouSchema) });

  useEffect(() => {
    accountApi.getAboutYou().then((d) => {
      reset({
        address: {
          line1: d.address.line1 ?? undefined,
          city: d.address.city ?? undefined,
          pinCode: d.address.pinCode ?? undefined,
          areaType: (d.address.areaType as UpdateAboutYouInput['address'] & object extends { areaType?: infer A } ? A : undefined) ?? undefined,
        },
        demographics: {
          educationLevel: (d.demographics.educationLevel as UpdateAboutYouInput['demographics'] & object extends { educationLevel?: infer E } ? E : undefined) ?? undefined,
          employmentType: (d.demographics.employmentType as UpdateAboutYouInput['demographics'] & object extends { employmentType?: infer T } ? T : undefined) ?? undefined,
          incomeBracket: d.demographics.incomeBracket ?? undefined,
          householdSize: d.demographics.householdSize ?? undefined,
          childrenCount: d.demographics.childrenCount ?? undefined,
          chiefWageEarner: d.demographics.chiefWageEarner ?? undefined,
        },
      });
    }).catch(() => {});
  }, [reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    try {
      await accountApi.updateAboutYou(values);
      setSuccess(true);
    } catch (err) {
      setError('root' as keyof UpdateAboutYouInput, { message: err instanceof ApiError ? err.message : 'Update failed' });
    }
  });

  const addrErrors = errors.address as Record<string, { message?: string }> | undefined;
  const demoErrors = errors.demographics as Record<string, { message?: string }> | undefined;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {success && <Alert variant="success">Profile updated.</Alert>}

      <p className="text-secondary text-sm font-medium">Address</p>
      <FormField label="Address line 1" error={addrErrors?.line1?.message}>
        {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('address.line1')} />}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="City" error={addrErrors?.city?.message}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('address.city')} />}
        </FormField>
        <FormField label="PIN code" error={addrErrors?.pinCode?.message}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('address.pinCode')} />}
        </FormField>
      </div>
      <FormField label="Area type" error={addrErrors?.areaType?.message}>
        {({ id, invalid }) => (
          <Select id={id} invalid={invalid} options={AREA} placeholder="Select…" {...register('address.areaType')} />
        )}
      </FormField>

      <p className="text-secondary mt-2 text-sm font-medium">Demographics</p>
      <FormField label="Education level" error={demoErrors?.educationLevel?.message}>
        {({ id, invalid }) => (
          <Select id={id} invalid={invalid} options={EDUCATION} placeholder="Select…" {...register('demographics.educationLevel')} />
        )}
      </FormField>
      <FormField label="Employment" error={demoErrors?.employmentType?.message}>
        {({ id, invalid }) => (
          <Select id={id} invalid={invalid} options={EMPLOYMENT} placeholder="Select…" {...register('demographics.employmentType')} />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Household size" error={demoErrors?.householdSize?.message}>
          {({ id, invalid }) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={20}
              invalid={invalid}
              {...register('demographics.householdSize', { valueAsNumber: true })}
            />
          )}
        </FormField>
        <FormField label="Children" error={demoErrors?.childrenCount?.message}>
          {({ id, invalid }) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={15}
              invalid={invalid}
              {...register('demographics.childrenCount', { valueAsNumber: true })}
            />
          )}
        </FormField>
      </div>

      <Button type="submit" loading={isSubmitting} fullWidth>
        Save
      </Button>
    </form>
  );
}
