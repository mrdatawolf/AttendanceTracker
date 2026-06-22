"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { getBrandFeatures, isGlobalReadAccessEnabled } from '@/lib/brand-features';

export function OfficeCapacitySettings() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [maxOutOfOffice, setMaxOutOfOffice] = useState<string>('');
  const [warningCount, setWarningCount] = useState<string>('3');
  const [criticalCount, setCriticalCount] = useState<string>('5');
  const [brandDefault, setBrandDefault] = useState<number>(0);
  const [brandWarningDefault, setBrandWarningDefault] = useState<number>(3);
  const [brandCriticalDefault, setBrandCriticalDefault] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Check if globalReadAccess is enabled
      const features = await getBrandFeatures();
      const enabled = isGlobalReadAccessEnabled(features);
      setFeatureEnabled(enabled);

      if (!enabled) {
        setLoading(false);
        return;
      }

      // Get brand defaults
      const brandMax = features.features.globalReadAccess?.maxOutOfOffice ?? 0;
      const brandWarn = features.features.globalReadAccess?.capacityWarningCount ?? 3;
      const brandCrit = features.features.globalReadAccess?.capacityCriticalCount ?? 5;
      setBrandDefault(brandMax);
      setBrandWarningDefault(brandWarn);
      setBrandCriticalDefault(brandCrit);

      // Get DB overrides
      const response = await authFetch('/api/app-settings');
      if (response.ok) {
        const settings = await response.json();
        setMaxOutOfOffice(settings.maxOutOfOffice !== undefined ? settings.maxOutOfOffice : String(brandMax));
        setWarningCount(settings.capacityWarningCount !== undefined ? settings.capacityWarningCount : String(brandWarn));
        setCriticalCount(settings.capacityCriticalCount !== undefined ? settings.capacityCriticalCount : String(brandCrit));
      }
    } catch (error) {
      console.error('Failed to load office capacity settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = [
        { key: 'maxOutOfOffice', value: maxOutOfOffice || '0' },
        { key: 'capacityWarningCount', value: warningCount || '3' },
        { key: 'capacityCriticalCount', value: criticalCount || '5' },
      ];

      const results = await Promise.all(
        settings.map(s =>
          authFetch('/api/app-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
          })
        )
      );

      if (results.some(r => !r.ok)) {
        throw new Error('Failed to save one or more settings');
      }

      toast({
        title: 'Settings Saved',
        description: 'Office capacity settings updated.',
      });
    } catch (error) {
      console.error('Failed to save office capacity settings:', error);
      toast({
        title: 'Save Failed',
        description: 'There was an error saving the settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!featureEnabled) {
    return null;
  }

  if (loading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Office Capacity</CardTitle>
        <CardDescription>
          Configure out-of-office limits and the capacity bar color thresholds on the attendance grid.
          Thresholds are the number of people out that triggers a color change.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="maxOutOfOffice" className="text-sm">
              Max out at once
            </Label>
            <Input
              id="maxOutOfOffice"
              type="number"
              min="0"
              className="w-24 h-8 text-sm"
              value={maxOutOfOffice}
              onChange={(e) => setMaxOutOfOffice(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              0 = no limit. Default: {brandDefault}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="warningCount" className="text-sm">
              Warning at # out
            </Label>
            <Input
              id="warningCount"
              type="number"
              min="0"
              className="w-24 h-8 text-sm"
              value={warningCount}
              onChange={(e) => setWarningCount(e.target.value)}
              placeholder="3"
            />
            <p className="text-xs text-muted-foreground">
              Bar turns yellow. Default: {brandWarningDefault}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="criticalCount" className="text-sm">
              Critical at # out
            </Label>
            <Input
              id="criticalCount"
              type="number"
              min="0"
              className="w-24 h-8 text-sm"
              value={criticalCount}
              onChange={(e) => setCriticalCount(e.target.value)}
              placeholder="5"
            />
            <p className="text-xs text-muted-foreground">
              Bar turns red. Default: {brandCriticalDefault}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
