"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/spinner';
import { Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface EmployeeOut {
  id: number;
  firstName: string;
  lastName: string;
  timeCode: string;
  hours: number;
}

interface DayForecast {
  date: string;
  dayName: string;
  expectedInOffice: number;
  percentCapacity: number;
  employeesOut: EmployeeOut[];
}

interface AttendanceForecast {
  totalActiveEmployees: number;
  daysToShow: number;
  timeOffCodes: string[];
  forecast: DayForecast[];
}

// Color classes based on capacity percentage
function getCapacityColorClass(percent: number): string {
  if (percent >= 90) return 'bg-green-100 border-green-300 text-green-800';
  if (percent >= 75) return 'bg-blue-100 border-blue-300 text-blue-800';
  if (percent >= 50) return 'bg-amber-100 border-amber-300 text-amber-800';
  return 'bg-red-100 border-red-300 text-red-800';
}

export function AttendanceForecastWidget() {
  const { authFetch } = useAuth();
  const [forecast, setForecast] = useState<AttendanceForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/dashboard/attendance-forecast');
      if (response.ok) {
        const data = await response.json();
        setForecast(data);
      } else if (response.status === 403) {
        // Feature not enabled - don't show error, just hide widget
        setForecast(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load forecast');
      }
    } catch (err) {
      console.error('Failed to load attendance forecast:', err);
      setError('Failed to load forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, [authFetch]);

  // Don't render if feature is disabled
  if (!loading && !forecast && !error) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Office Attendance Forecast</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={loadForecast}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!forecast) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Office Attendance Forecast</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={loadForecast}
            title="Refresh forecast"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {forecast.forecast.map((day) => (
            <Popover key={day.date}>
              <PopoverTrigger asChild>
                <div
                  className={`border rounded-lg p-2 text-center cursor-pointer transition-colors hover:opacity-80 ${getCapacityColorClass(day.percentCapacity)}`}
                >
                  <div className="text-xs font-medium truncate">{day.dayName.split(',')[0]}</div>
                  <div className="text-lg font-bold">{day.expectedInOffice}</div>
                  <div className="text-xs opacity-75">{day.percentCapacity}%</div>
                </div>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-xs">
                <div className="text-sm">
                  <p className="font-semibold">{day.dayName}</p>
                  <p className="text-muted-foreground">
                    {day.expectedInOffice} of {forecast.totalActiveEmployees} expected
                  </p>
                  {day.employeesOut.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-medium text-xs">Out:</p>
                      <ul className="text-xs space-y-0.5">
                        {day.employeesOut.slice(0, 5).map((emp, idx) => (
                          <li key={`${emp.id}-${idx}`}>
                            {emp.firstName} {emp.lastName.charAt(0)}. ({emp.timeCode})
                          </li>
                        ))}
                        {day.employeesOut.length > 5 && (
                          <li className="text-muted-foreground">
                            +{day.employeesOut.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      No one scheduled off
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Based on {forecast.totalActiveEmployees} active employees
        </p>
      </CardContent>
    </Card>
  );
}
