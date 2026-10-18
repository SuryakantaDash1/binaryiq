'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Switch, Alert, Skeleton, Modal, Heading, Text } from '@binaryiq/ui';
import { dataRightsApi, type ConsentState, type ConsentType } from '@/lib/api/data-rights.js';
import { ApiError } from '@/lib/api/client.js';

const CONSENT_LABELS: Record<
  ConsentType,
  { label: string; description: string; required?: boolean }
> = {
  TERMS: { label: 'Terms of Service', description: 'Required to use the platform.', required: true },
  PRIVACY: { label: 'Privacy Policy', description: 'Required to use the platform.', required: true },
  MARKETING: { label: 'Marketing Communications', description: 'Receive promotional offers and updates.' },
  COOKIES: { label: 'Analytics Cookies', description: 'Help us improve your experience.' },
};

const CONSENT_VERSION = '1.0';

export function ConsentCentre(): React.JSX.Element {
  const [state, setState] = useState<ConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadState = useCallback(() => {
    setLoading(true);
    dataRightsApi
      .getConsents()
      .then(setState)
      .catch(() => setError('Failed to load privacy settings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  async function handleToggle(type: ConsentType, granted: boolean) {
    if (CONSENT_LABELS[type]?.required) return; // can't toggle required
    setUpdating(type);
    setError(null);
    try {
      await dataRightsApi.grantConsent({
        consentType: type,
        consentVersion: CONSENT_VERSION,
        granted,
      });
      setState((prev) =>
        prev ? { ...prev, current: { ...prev.current, [type]: granted } } : prev,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await dataRightsApi.downloadExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await dataRightsApi.deleteAccount('DELETE');
      localStorage.clear();
      window.location.href = '/login?deleted=1';
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Deletion failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Consent settings */}
      <section>
        <Heading level={3} className="mb-4">
          Consent Settings
        </Heading>
        <div className="space-y-4">
          {(['TERMS', 'PRIVACY', 'MARKETING', 'COOKIES'] as const).map((type) => {
            const meta = CONSENT_LABELS[type];
            const granted = state?.current[type] ?? (meta.required ? true : false);
            return (
              <div
                key={type}
                className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
              >
                <div>
                  <p className="text-sm font-medium text-text">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{meta.description}</p>
                </div>
                <Switch
                  checked={granted}
                  onChange={(val) => {
                    void handleToggle(type, val);
                  }}
                  disabled={!!meta.required || updating === type}
                  label=""
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Data export */}
      <section>
        <Heading level={3} className="mb-2">
          Download My Data
        </Heading>
        <Text color="secondary" size="sm" className="mb-4">
          Download a copy of all the personal data we hold about you, as a JSON file.
        </Text>
        {exportDone && (
          <p className="mb-2 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
            Your data has been downloaded. Keep the file somewhere safe — it contains your personal details.
          </p>
        )}
        {exportError && (
          <Alert variant="error" className="mb-2">
            {exportError}
          </Alert>
        )}
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Preparing export…' : 'Download my data'}
        </Button>
      </section>

      {/* Delete account */}
      <section>
        <Heading level={3} className="mb-2">
          Delete My Account
        </Heading>
        <Text color="secondary" size="sm" className="mb-4">
          Permanently delete your account and all personal data. This cannot be undone.
        </Text>
        <Button
          variant="outline"
          className="border-red-500 text-red-600 hover:bg-red-50"
          onClick={() => setShowDeleteModal(true)}
        >
          Delete my account
        </Button>
      </section>

      {/* Delete confirm modal */}
      <Modal
        open={showDeleteModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteModal(false);
            setDeleteConfirm('');
            setDeleteError(null);
          }
        }}
        title="Delete account"
      >
        <div className="space-y-4">
          <Alert variant="error">
            This action is irreversible. Your account will be deactivated immediately and
            permanently deleted after a grace period.
          </Alert>
          <p className="text-sm text-text">
            Type <strong>DELETE</strong> to confirm:
          </p>
          <input
            type="text"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-red-300"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
          />
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleteConfirm !== 'DELETE' || deleting}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
