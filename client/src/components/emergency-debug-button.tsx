import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function EmergencyDebugButton() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runEmergencyCheck = async () => {
    setLoading(true);
    try {
      // EMERGENCY: Starting contract verification
      
      const response = await fetch('/api/emergency/verify-contract', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      setResult(data);
    } catch (error) {
      console.error('🚨 EMERGENCY: Contract verification failed:', error);
      setResult({ error: (error as Error).message || 'Emergency check failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={runEmergencyCheck}
        disabled={loading}
        variant="destructive"
        className="bg-red-600 hover:bg-red-700"
      >
        {loading ? 'Running Emergency Check...' : '🚨 Emergency Contract Verification'}
      </Button>
      
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Emergency Verification Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>Contract:</strong> {result.contractAddress}</div>
              <div><strong>Timestamp:</strong> {result.timestamp}</div>
              
              {result.checks && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Contract Checks:</h3>
                  <div>Has Code: {result.checks.hasCode ? '✅ YES' : '❌ NO'}</div>
                  <div>Code Length: {result.checks.codeLength}</div>
                  <div>Chain ID: {result.checks.chainId}</div>
                  <div>Is Base Mainnet: {result.checks.isBaseMainnet ? '✅ YES' : '❌ NO'}</div>
                  <div>RPC Working: {result.checks.rpcWorking ? '✅ YES' : '❌ NO'}</div>
                  <div>Current Block: {result.checks.currentBlock}</div>
                  
                  {result.checks.hasCode && (
                    <div>
                      <h4 className="font-semibold mt-2">Nonce Function Test:</h4>
                      <div>Success: {result.checks.nonceCallSuccess ? '✅ YES' : '❌ NO'}</div>
                      {result.checks.nonceValue && <div>Nonce Value: {result.checks.nonceValue}</div>}
                      {result.checks.nonceCallError && (
                        <Alert>
                          <AlertDescription>
                            <strong>Error:</strong> {result.checks.nonceCallError}
                          </AlertDescription>
                        </Alert>
                      )}
                      {result.checks.nonceCallDetails && (
                        <div className="text-sm">
                          <div>Code: {result.checks.nonceCallDetails.code}</div>
                          <div>Reason: {result.checks.nonceCallDetails.reason}</div>
                          <div>Data: {result.checks.nonceCallDetails.data}</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {result.checks.alternativeRpcResults && (
                    <div>
                      <h4 className="font-semibold mt-2">Alternative RPC Results:</h4>
                      {Object.entries(result.checks.alternativeRpcResults).map(([endpoint, data]: [string, any]) => (
                        <div key={endpoint} className="ml-2">
                          <div><strong>{endpoint}:</strong></div>
                          <div>Working: {data.working ? '✅ YES' : '❌ NO'}</div>
                          {data.hasCode !== undefined && <div>Has Code: {data.hasCode ? '✅ YES' : '❌ NO'}</div>}
                          {data.error && <div>Error: {data.error}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {result.error && (
                <Alert>
                  <AlertDescription>
                    <strong>Critical Error:</strong> {result.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold">Raw Response</summary>
              <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}