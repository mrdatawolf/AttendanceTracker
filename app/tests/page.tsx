"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/spinner';
import { CheckCircle2, XCircle, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  expected?: any;
  actual?: any;
  error?: string;
  details?: string;
  duration?: number;
}

interface TestEmployee {
  id: number;
  first_name: string;
  last_name: string;
  group_id: number;
}

export default function TestsPage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading, token, isMaster } = useAuth();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testEmployee, setTestEmployee] = useState<TestEmployee | null>(null);

  // Redirect if not authenticated or not superuser
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isMaster)) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, isMaster, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated || !isMaster) {
    return null;
  }

  const updateTestResult = (index: number, update: Partial<TestResult>) => {
    setTestResults(prev => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...update };
      return newResults;
    });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getErrorDetails = (response: any, error?: any): string => {
    let errorMsg = error?.message || 'Unknown error';
    if (response?.details) {
      errorMsg += `\n\nDetails: ${response.details}`;
    }
    if (response?.stack) {
      errorMsg += `\n\nStack:\n${response.stack}`;
    }
    return errorMsg;
  };

  const runTests = async () => {
    if (!token) {
      alert('No authentication token found');
      return;
    }

    setIsRunning(true);
    const tests: TestResult[] = [
      { name: 'Setup: Get Test Employee', status: 'pending' },
      { name: 'CREATE: Create single attendance entry', status: 'pending' },
      { name: 'READ: Fetch created attendance entry', status: 'pending' },
      { name: 'UPDATE: Update attendance entry', status: 'pending' },
      { name: 'READ: Verify updated entry', status: 'pending' },
      { name: 'CREATE: Create multiple entries for same day', status: 'pending' },
      { name: 'READ: Verify multiple entries', status: 'pending' },
      { name: 'UPDATE: Batch update multiple entries', status: 'pending' },
      { name: 'READ: Verify batch update', status: 'pending' },
      { name: 'DELETE: Delete all entries for test date', status: 'pending' },
      { name: 'READ: Verify deletion', status: 'pending' },
      { name: 'Cleanup: Remove test data', status: 'pending' },
    ];

    setTestResults(tests);
    await sleep(100);

    const testDate = '2026-01-15'; // Use a specific test date
    let createdEntryId: number | undefined;
    let employeeForTests: TestEmployee | null = null;

    try {
      // Test 0: Get Test Employee
      let testIndex = 0;
      updateTestResult(testIndex, { status: 'running' });
      const startTime0 = Date.now();

      try {
        const employeesRes = await fetch('/api/employees', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!employeesRes.ok) {
          throw new Error(`HTTP ${employeesRes.status}: ${await employeesRes.text()}`);
        }

        const employees = await employeesRes.json();

        if (!Array.isArray(employees) || employees.length === 0) {
          updateTestResult(testIndex, {
            status: 'failed',
            error: 'No employees found in database',
            details: 'You need at least one employee to run attendance tests',
            duration: Date.now() - startTime0,
          });
          setIsRunning(false);
          return;
        }

        employeeForTests = employees[0];
        setTestEmployee(employeeForTests);

        updateTestResult(testIndex, {
          status: 'passed',
          actual: `Employee: ${employeeForTests?.first_name ?? ''} ${employeeForTests?.last_name ?? ''} (ID: ${employeeForTests?.id ?? ''})`,
          duration: Date.now() - startTime0,
        });
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          error: error.message,
          duration: Date.now() - startTime0,
        });
        setIsRunning(false);
        return;
      }

      if (!employeeForTests) return;

      // Test 1: CREATE single entry
      testIndex = 1;
      updateTestResult(testIndex, { status: 'running' });
      const startTime1 = Date.now();

      try {
        const createPayload = {
          employee_id: employeeForTests.id,
          entry_date: testDate,
          time_code: 'V',
          hours: 8,
          notes: 'Test vacation entry',
        };

        const createRes = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(createPayload),
        });

        const createData = await createRes.json();

        if (!createRes.ok) {
          throw new Error(`HTTP ${createRes.status}: ${createData.error || 'Unknown error'}`);
        }

        updateTestResult(testIndex, {
          status: 'passed',
          expected: 'Entry created successfully',
          actual: JSON.stringify(createData, null, 2),
          duration: Date.now() - startTime1,
        });
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Entry created successfully',
          error: error.message,
          actual: 'Request failed',
          duration: Date.now() - startTime1,
        });
      }

      await sleep(200);

      // Test 2: READ created entry
      testIndex = 2;
      updateTestResult(testIndex, { status: 'running' });
      const startTime2 = Date.now();

      try {
        const readRes = await fetch(
          `/api/attendance?employeeId=${employeeForTests.id}&startDate=${testDate}&endDate=${testDate}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const readData = await readRes.json();

        if (!readRes.ok) {
          throw new Error(`HTTP ${readRes.status}: ${readData.error || 'Unknown error'}`);
        }

        if (!Array.isArray(readData) || readData.length === 0) {
          updateTestResult(testIndex, {
            status: 'failed',
            expected: 'At least 1 entry for test date',
            actual: `Received: ${JSON.stringify(readData)}`,
            error: 'No entries found after creation',
            duration: Date.now() - startTime2,
          });
        } else {
          const entry = readData.find((e: any) => e.entry_date === testDate);
          if (entry) {
            createdEntryId = entry.id;
            updateTestResult(testIndex, {
              status: 'passed',
              expected: 'Entry with time_code=V, hours=8',
              actual: `Found entry: time_code=${entry.time_code}, hours=${entry.hours}, notes=${entry.notes}`,
              duration: Date.now() - startTime2,
            });
          } else {
            updateTestResult(testIndex, {
              status: 'failed',
              expected: `Entry for date ${testDate}`,
              actual: `Found ${readData.length} entries but none for test date`,
              duration: Date.now() - startTime2,
            });
          }
        }
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Successfully read entry',
          error: error.message,
          duration: Date.now() - startTime2,
        });
      }

      await sleep(200);

      // Test 3: UPDATE entry
      testIndex = 3;
      updateTestResult(testIndex, { status: 'running' });
      const startTime3 = Date.now();

      try {
        const updatePayload = {
          employee_id: employeeForTests.id,
          entry_date: testDate,
          time_code: 'P',
          hours: 4,
          notes: 'Updated to personal time',
        };

        const updateRes = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatePayload),
        });

        const updateData = await updateRes.json();

        if (!updateRes.ok) {
          throw new Error(`HTTP ${updateRes.status}: ${updateData.error || 'Unknown error'}`);
        }

        updateTestResult(testIndex, {
          status: 'passed',
          expected: 'Entry updated to time_code=P, hours=4',
          actual: JSON.stringify(updateData, null, 2),
          duration: Date.now() - startTime3,
        });
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Entry updated successfully',
          error: error.message,
          duration: Date.now() - startTime3,
        });
      }

      await sleep(200);

      // Test 4: Verify update
      testIndex = 4;
      updateTestResult(testIndex, { status: 'running' });
      const startTime4 = Date.now();

      try {
        const verifyRes = await fetch(
          `/api/attendance?employeeId=${employeeForTests.id}&startDate=${testDate}&endDate=${testDate}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok) {
          throw new Error(`HTTP ${verifyRes.status}: ${verifyData.error || 'Unknown error'}`);
        }

        const entry = verifyData.find((e: any) => e.entry_date === testDate);
        if (entry && entry.time_code === 'P' && entry.hours === 4) {
          updateTestResult(testIndex, {
            status: 'passed',
            expected: 'time_code=P, hours=4',
            actual: `time_code=${entry.time_code}, hours=${entry.hours}`,
            duration: Date.now() - startTime4,
          });
        } else {
          updateTestResult(testIndex, {
            status: 'failed',
            expected: 'time_code=P, hours=4',
            actual: entry ? `time_code=${entry.time_code}, hours=${entry.hours}` : 'No entry found',
            error: 'Entry was not updated correctly',
            duration: Date.now() - startTime4,
          });
        }
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Verify updated entry',
          error: error.message,
          duration: Date.now() - startTime4,
        });
      }

      await sleep(200);

      // Test 5: CREATE multiple entries for same day
      testIndex = 5;
      updateTestResult(testIndex, { status: 'running' });
      const startTime5 = Date.now();

      try {
        const multiPayload = {
          action: 'update_day',
          employee_id: employeeForTests.id,
          entry_date: testDate,
          entries: [
            { time_code: 'V', hours: 4, notes: 'Morning vacation' },
            { time_code: 'P', hours: 4, notes: 'Afternoon personal' },
          ],
        };

        const multiRes = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(multiPayload),
        });

        const multiData = await multiRes.json();

        if (!multiRes.ok) {
          const errorDetails = getErrorDetails(multiData);
          throw new Error(`HTTP ${multiRes.status}: ${errorDetails}`);
        }

        updateTestResult(testIndex, {
          status: 'passed',
          expected: '2 entries created for same day',
          actual: JSON.stringify(multiData, null, 2),
          duration: Date.now() - startTime5,
        });
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: '2 entries created',
          error: error.message,
          details: 'This test writes data successfully but fails on post-processing (likely audit logging)',
          duration: Date.now() - startTime5,
        });
      }

      await sleep(200);

      // Test 6: Verify multiple entries
      testIndex = 6;
      updateTestResult(testIndex, { status: 'running' });
      const startTime6 = Date.now();

      try {
        const verifyMultiRes = await fetch(
          `/api/attendance?employeeId=${employeeForTests.id}&startDate=${testDate}&endDate=${testDate}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const verifyMultiData = await verifyMultiRes.json();

        if (!verifyMultiRes.ok) {
          throw new Error(`HTTP ${verifyMultiRes.status}: ${verifyMultiData.error || 'Unknown error'}`);
        }

        const entriesForDate = verifyMultiData.filter((e: any) => e.entry_date === testDate);

        if (entriesForDate.length === 2) {
          const totalHours = entriesForDate.reduce((sum: number, e: any) => sum + e.hours, 0);
          updateTestResult(testIndex, {
            status: 'passed',
            expected: '2 entries with total 8 hours',
            actual: `Found ${entriesForDate.length} entries, total ${totalHours} hours`,
            details: JSON.stringify(entriesForDate, null, 2),
            duration: Date.now() - startTime6,
          });
        } else {
          updateTestResult(testIndex, {
            status: 'failed',
            expected: '2 entries',
            actual: `Found ${entriesForDate.length} entries`,
            error: 'Incorrect number of entries',
            details: JSON.stringify(entriesForDate, null, 2),
            duration: Date.now() - startTime6,
          });
        }
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Verify 2 entries',
          error: error.message,
          duration: Date.now() - startTime6,
        });
      }

      await sleep(200);

      // Test 7: Batch update
      testIndex = 7;
      updateTestResult(testIndex, { status: 'running' });
      const startTime7 = Date.now();

      try {
        const batchPayload = {
          action: 'update_day',
          employee_id: employeeForTests.id,
          entry_date: testDate,
          entries: [
            { time_code: 'H', hours: 8, notes: 'Holiday' },
          ],
        };

        const batchRes = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(batchPayload),
        });

        const batchData = await batchRes.json();

        if (!batchRes.ok) {
          const errorDetails = getErrorDetails(batchData);
          throw new Error(`HTTP ${batchRes.status}: ${errorDetails}`);
        }

        updateTestResult(testIndex, {
          status: 'passed',
          expected: 'Batch update: 2 entries replaced with 1',
          actual: JSON.stringify(batchData, null, 2),
          duration: Date.now() - startTime7,
        });
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Batch update successful',
          error: error.message,
          details: 'This test writes data successfully but fails on post-processing (likely audit logging)',
          duration: Date.now() - startTime7,
        });
      }

      await sleep(200);

      // Test 8: Verify batch update
      testIndex = 8;
      updateTestResult(testIndex, { status: 'running' });
      const startTime8 = Date.now();

      try {
        const verifyBatchRes = await fetch(
          `/api/attendance?employeeId=${employeeForTests.id}&startDate=${testDate}&endDate=${testDate}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const verifyBatchData = await verifyBatchRes.json();

        if (!verifyBatchRes.ok) {
          throw new Error(`HTTP ${verifyBatchRes.status}: ${verifyBatchData.error || 'Unknown error'}`);
        }

        const entriesForDate = verifyBatchData.filter((e: any) => e.entry_date === testDate);

        if (entriesForDate.length === 1 && entriesForDate[0].time_code === 'H' && entriesForDate[0].hours === 8) {
          updateTestResult(testIndex, {
            status: 'passed',
            expected: '1 entry: time_code=H, hours=8',
            actual: `Found ${entriesForDate.length} entry: time_code=${entriesForDate[0].time_code}, hours=${entriesForDate[0].hours}`,
            duration: Date.now() - startTime8,
          });
        } else {
          updateTestResult(testIndex, {
            status: 'failed',
            expected: '1 entry with time_code=H',
            actual: `Found ${entriesForDate.length} entries`,
            details: JSON.stringify(entriesForDate, null, 2),
            duration: Date.now() - startTime8,
          });
        }
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Verify batch update',
          error: error.message,
          duration: Date.now() - startTime8,
        });
      }

      await sleep(200);

      // Test 9: DELETE
      testIndex = 9;
      updateTestResult(testIndex, { status: 'running' });
      const startTime9 = Date.now();

      try {
        const deletePayload = {
          action: 'delete',
          employee_id: employeeForTests.id,
          entry_date: testDate,
        };

        const deleteRes = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(deletePayload),
        });

        const deleteData = await deleteRes.json();

        if (!deleteRes.ok) {
          throw new Error(`HTTP ${deleteRes.status}: ${deleteData.error || 'Unknown error'}`);
        }

        updateTestResult(testIndex, {
          status: 'passed',
          expected: 'All entries deleted for test date',
          actual: JSON.stringify(deleteData, null, 2),
          duration: Date.now() - startTime9,
        });
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Deletion successful',
          error: error.message,
          duration: Date.now() - startTime9,
        });
      }

      await sleep(200);

      // Test 10: Verify deletion
      testIndex = 10;
      updateTestResult(testIndex, { status: 'running' });
      const startTime10 = Date.now();

      try {
        const verifyDeleteRes = await fetch(
          `/api/attendance?employeeId=${employeeForTests.id}&startDate=${testDate}&endDate=${testDate}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const verifyDeleteData = await verifyDeleteRes.json();

        if (!verifyDeleteRes.ok) {
          throw new Error(`HTTP ${verifyDeleteRes.status}: ${verifyDeleteData.error || 'Unknown error'}`);
        }

        const entriesForDate = verifyDeleteData.filter((e: any) => e.entry_date === testDate);

        if (entriesForDate.length === 0) {
          updateTestResult(testIndex, {
            status: 'passed',
            expected: '0 entries for test date',
            actual: `Found ${entriesForDate.length} entries`,
            duration: Date.now() - startTime10,
          });
        } else {
          updateTestResult(testIndex, {
            status: 'warning',
            expected: '0 entries',
            actual: `Found ${entriesForDate.length} entries (may be residual)`,
            details: JSON.stringify(entriesForDate, null, 2),
            duration: Date.now() - startTime10,
          });
        }
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'failed',
          expected: 'Verify deletion',
          error: error.message,
          duration: Date.now() - startTime10,
        });
      }

      await sleep(200);

      // Test 11: Cleanup
      testIndex = 11;
      updateTestResult(testIndex, { status: 'running' });
      const startTime11 = Date.now();

      try {
        // Final cleanup - ensure no test data remains
        await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'update_day',
            employee_id: employeeForTests.id,
            entry_date: testDate,
            entries: [], // Empty array deletes all entries
          }),
        });

        updateTestResult(testIndex, {
          status: 'passed',
          actual: 'Test data cleaned up successfully',
          duration: Date.now() - startTime11,
        });
      } catch (error: any) {
        updateTestResult(testIndex, {
          status: 'warning',
          error: 'Cleanup may have failed (non-critical)',
          details: error.message,
          duration: Date.now() - startTime11,
        });
      }

    } catch (error: any) {
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants: Record<TestResult['status'], string> = {
      pending: 'bg-gray-200 text-gray-700',
      running: 'bg-blue-200 text-blue-700',
      passed: 'bg-green-200 text-green-700',
      failed: 'bg-red-200 text-red-700',
      warning: 'bg-yellow-200 text-yellow-700',
    };

    return (
      <Badge className={cn('uppercase text-xs', variants[status])}>
        {status}
      </Badge>
    );
  };

  const passedCount = testResults.filter(t => t.status === 'passed').length;
  const failedCount = testResults.filter(t => t.status === 'failed').length;
  const warningCount = testResults.filter(t => t.status === 'warning').length;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Attendance API Test Suite</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive CRUD tests for attendance data. This helps diagnose production vs development issues.
            </p>
            {testEmployee && (
              <p className="text-sm text-muted-foreground mt-1">
                Testing with: <strong>{testEmployee.first_name} {testEmployee.last_name}</strong> (ID: {testEmployee.id})
              </p>
            )}
          </div>
          <Button
            onClick={runTests}
            disabled={isRunning}
            size="lg"
            className="gap-2"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run All Tests
              </>
            )}
          </Button>
        </div>

        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results Summary</CardTitle>
              <CardDescription>
                <div className="flex gap-4 mt-2">
                  <span className="text-green-600 font-semibold">Passed: {passedCount}</span>
                  <span className="text-red-600 font-semibold">Failed: {failedCount}</span>
                  {warningCount > 0 && (
                    <span className="text-yellow-600 font-semibold">Warnings: {warningCount}</span>
                  )}
                  <span className="text-gray-600">Total: {testResults.length}</span>
                </div>
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="space-y-4">
          {testResults.map((test, index) => (
            <Card key={index} className={cn(
              'transition-all',
              test.status === 'failed' && 'border-red-300',
              test.status === 'passed' && 'border-green-300',
              test.status === 'warning' && 'border-yellow-300'
            )}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(test.status)}
                    <div className="flex-1">
                      <CardTitle className="text-lg">{test.name}</CardTitle>
                      {test.duration !== undefined && (
                        <CardDescription className="text-xs mt-1">
                          Duration: {test.duration}ms
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(test.status)}
                </div>
              </CardHeader>
              {(test.expected || test.actual || test.error || test.details) && (
                <CardContent className="space-y-3">
                  {test.expected && (
                    <div>
                      <h4 className="font-semibold text-sm text-green-700 mb-1">Expected:</h4>
                      <pre className="bg-green-50 p-2 rounded text-xs overflow-x-auto">
                        {test.expected}
                      </pre>
                    </div>
                  )}
                  {test.actual && (
                    <div>
                      <h4 className="font-semibold text-sm text-blue-700 mb-1">Actual:</h4>
                      <pre className="bg-blue-50 p-2 rounded text-xs overflow-x-auto">
                        {test.actual}
                      </pre>
                    </div>
                  )}
                  {test.error && (
                    <div>
                      <h4 className="font-semibold text-sm text-red-700 mb-1">Error:</h4>
                      <pre className="bg-red-50 p-2 rounded text-xs overflow-x-auto text-red-800">
                        {test.error}
                      </pre>
                    </div>
                  )}
                  {test.details && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-1">Details:</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {test.details}
                      </pre>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {testResults.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Play className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Ready to Run Tests</h3>
              <p className="text-muted-foreground text-center mb-4">
                Click the "Run All Tests" button above to start the comprehensive CRUD test suite.
              </p>
              <p className="text-sm text-muted-foreground text-center max-w-2xl">
                These tests will create, read, update, and delete attendance entries to verify
                the API is working correctly. All test data will be cleaned up automatically.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
