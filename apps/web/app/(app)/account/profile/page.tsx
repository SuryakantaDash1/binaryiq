'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileInput } from '@influencer/types';
import { FormField, Input, Select, Button, Alert, Avatar } from '@influencer/ui';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { accountApi } from '@/lib/api/account';
import type { ProfileData } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export default function ProfileTab(): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema) });

  useEffect(() => {
    accountApi.getProfile().then((p) => {
      setProfile(p);
      reset({ firstName: p.firstName, surname: p.surname, dob: p.dob, gender: p.gender as UpdateProfileInput['gender'] });
    }).catch(() => {});
  }, [reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    try {
      const updated = await accountApi.updateProfile(values);
      setProfile(updated);
      setSuccess(true);
      reset(values);
    } catch (err) {
      setError('root', { message: err instanceof ApiError ? err.message : 'Update failed' });
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {profile && (
        <div className="flex items-center gap-4">
          <Avatar src={profile.photoUrl} name={`${profile.firstName} ${profile.surname}`} size="lg" />
          <div>
            <p className="text-text font-semibold">{profile.firstName} {profile.surname}</p>
            <p className="text-secondary text-sm">{profile.country}</p>
          </div>
        </div>
      )}

      {success && <Alert variant="success">Profile updated successfully.</Alert>}
      {errors.root && <Alert variant="error">{errors.root.message}</Alert>}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" error={errors.firstName?.message} required>
            {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('firstName')} />}
          </FormField>
          <FormField label="Surname" error={errors.surname?.message} required>
            {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('surname')} />}
          </FormField>
        </div>
        <FormField label="Date of birth" hint="YYYY-MM-DD" error={errors.dob?.message} required>
          {({ id, invalid }) => <Input id={id} type="date" invalid={invalid} {...register('dob')} />}
        </FormField>
        <FormField label="Gender" error={errors.gender?.message} required>
          {({ id, invalid }) => (
            <Select id={id} invalid={invalid} options={GENDER_OPTIONS} placeholder="Select…" {...register('gender')} />
          )}
        </FormField>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty} fullWidth>
          Save changes
        </Button>
      </form>
    </div>
  );
}
