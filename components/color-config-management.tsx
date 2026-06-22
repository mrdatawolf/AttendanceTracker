"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Palette, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeatureConfig {
  enabled: boolean;
  allowTimeCodeColors: boolean;
  allowStatusColors: boolean;
}

interface ColorConfig {
  id: number;
  config_type: 'time_code' | 'status';
  config_key: string;
  color_name: string;
}

interface TimeCodeInfo {
  code: string;
  description: string;
  defaultColor: string;
}

interface AvailableColor {
  name: string;
  label: string;
}

// Color swatch styles for the palette
const colorSwatchStyles: Record<string, { bg: string; text: string }> = {
  blue: { bg: '#dbeafe', text: '#1e40af' },
  amber: { bg: '#fef3c7', text: '#92400e' },
  red: { bg: '#fee2e2', text: '#991b1b' },
  teal: { bg: '#ccfbf1', text: '#115e59' },
  purple: { bg: '#f3e8ff', text: '#6b21a8' },
  green: { bg: '#dcfce7', text: '#166534' },
  gray: { bg: '#f3f4f6', text: '#374151' },
};

function ColorSwatch({ colorName }: { colorName: string }) {
  const style = colorSwatchStyles[colorName] || colorSwatchStyles.gray;
  return (
    <div
      className="inline-flex items-center gap-2 px-2 py-1 rounded border"
      style={{ backgroundColor: style.bg, borderColor: style.text + '40' }}
    >
      <div
        className="w-3 h-3 rounded-full border"
        style={{ backgroundColor: style.text, borderColor: style.text }}
      />
      <span className="text-sm capitalize" style={{ color: style.text }}>
        {colorName}
      </span>
    </div>
  );
}

export function ColorConfigManagement() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const [featureConfig, setFeatureConfig] = useState<FeatureConfig>({
    enabled: false,
    allowTimeCodeColors: false,
    allowStatusColors: false,
  });
  const [colorConfigs, setColorConfigs] = useState<ColorConfig[]>([]);
  const [timeCodes, setTimeCodes] = useState<TimeCodeInfo[]>([]);
  const [availableColors, setAvailableColors] = useState<AvailableColor[]>([]);

  const fetchColorConfigs = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const res = await fetch('/api/color-config', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setFeatureConfig(data.featureConfig || { enabled: false, allowTimeCodeColors: false, allowStatusColors: false });
        setColorConfigs(data.colorConfigs || []);
        setTimeCodes(data.timeCodes || []);
        setAvailableColors(data.availableColors || []);
      } else {
        console.error('Failed to fetch color configs:', res.status);
      }
    } catch (error) {
      console.error('Failed to fetch color configs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchColorConfigs();
  }, [fetchColorConfigs]);

  const getCurrentColor = (configType: 'time_code' | 'status', configKey: string, defaultColor: string): string => {
    const config = colorConfigs.find(c => c.config_type === configType && c.config_key === configKey);
    return config?.color_name || defaultColor;
  };

  const isCustomized = (configType: 'time_code' | 'status', configKey: string): boolean => {
    return colorConfigs.some(c => c.config_type === configType && c.config_key === configKey);
  };

  const handleColorChange = async (configType: 'time_code' | 'status', configKey: string, colorName: string) => {
    if (!token) return;

    const savingKey = `${configType}-${configKey}`;
    setIsSaving(savingKey);

    try {
      const res = await fetch('/api/color-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ configType, configKey, colorName }),
      });

      if (res.ok) {
        toast({
          title: 'Color updated',
          description: `Color for ${configKey} has been updated to ${colorName}.`,
        });
        fetchColorConfigs();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update color.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while updating the color.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(null);
    }
  };

  const handleReset = async (configType: 'time_code' | 'status', configKey: string) => {
    if (!token) return;

    const savingKey = `${configType}-${configKey}`;
    setIsSaving(savingKey);

    try {
      const res = await fetch(`/api/color-config?configType=${configType}&configKey=${configKey}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast({
          title: 'Color reset',
          description: `Color for ${configKey} has been reset to default.`,
        });
        fetchColorConfigs();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to reset color.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while resetting the color.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(null);
    }
  };

  if (!featureConfig.enabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Color Configuration
        </CardTitle>
        <CardDescription>
          Customize colors for time codes and status indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Time Code Colors */}
            {featureConfig.allowTimeCodeColors && timeCodes.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Time Code Colors</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[180px]">Color</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeCodes.map((tc) => {
                      const currentColor = getCurrentColor('time_code', tc.code, tc.defaultColor);
                      const customized = isCustomized('time_code', tc.code);
                      const savingKey = `time_code-${tc.code}`;

                      return (
                        <TableRow key={tc.code}>
                          <TableCell className="font-mono font-medium">{tc.code}</TableCell>
                          <TableCell>{tc.description}</TableCell>
                          <TableCell>
                            <Select
                              value={currentColor}
                              onValueChange={(value) => handleColorChange('time_code', tc.code, value)}
                              disabled={isSaving === savingKey}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue>
                                  <ColorSwatch colorName={currentColor} />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {availableColors.map((color) => (
                                  <SelectItem key={color.name} value={color.name}>
                                    <ColorSwatch colorName={color.name} />
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {customized && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReset('time_code', tc.code)}
                                disabled={isSaving === savingKey}
                                title="Reset to default"
                              >
                                {isSaving === savingKey ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Status Colors */}
            {featureConfig.allowStatusColors && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Status Colors</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[180px]">Color</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { key: 'warning', label: 'Warning', description: 'Usage at 90%+ of allocation', defaultColor: 'amber' },
                      { key: 'critical', label: 'Critical', description: 'Usage at 100%+ of allocation', defaultColor: 'red' },
                    ].map((status) => {
                      const currentColor = getCurrentColor('status', status.key, status.defaultColor);
                      const customized = isCustomized('status', status.key);
                      const savingKey = `status-${status.key}`;

                      return (
                        <TableRow key={status.key}>
                          <TableCell className="font-medium">{status.label}</TableCell>
                          <TableCell className="text-muted-foreground">{status.description}</TableCell>
                          <TableCell>
                            <Select
                              value={currentColor}
                              onValueChange={(value) => handleColorChange('status', status.key, value)}
                              disabled={isSaving === savingKey}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue>
                                  <ColorSwatch colorName={currentColor} />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {availableColors.map((color) => (
                                  <SelectItem key={color.name} value={color.name}>
                                    <ColorSwatch colorName={color.name} />
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {customized && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReset('status', status.key)}
                                disabled={isSaving === savingKey}
                                title="Reset to default"
                              >
                                {isSaving === savingKey ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
