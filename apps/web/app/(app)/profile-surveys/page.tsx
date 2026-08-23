import { redirect } from 'next/navigation';

export default function ProfileSurveysRedirect(): never {
  redirect('/account/profile-surveys');
}
