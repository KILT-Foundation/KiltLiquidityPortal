/**
 * POSITION LIFECYCLE MONITOR
 * Component for admin monitoring of automatic position lifecycle management
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Play, Square, RefreshCw, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LifecycleStatus {
  isRunning: boolean;
  hasInterval: boolean;
}

export function PositionLifecycleMonitor() {
  const [userAddress, setUserAddress] = useState("");
  const queryClient = useQueryClient();

  // Get lifecycle service status
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ["/api/position-lifecycle/status"],
    refetchInterval: 10000, // Check every 10 seconds
  });

  const status: LifecycleStatus = (statusData as any)?.status || { isRunning: false, hasInterval: false };

  // Manual user check mutation
  const checkUserMutation = useMutation({
    mutationFn: async (address: string) => {
      return apiRequest(`/api/position-lifecycle/check-user/${address}`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/position-lifecycle/status"] });
    }
  });

  // Start service mutation
  const startServiceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/position-lifecycle/start", {
        method: "POST"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/position-lifecycle/status"] });
    }
  });

  // Stop service mutation
  const stopServiceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/position-lifecycle/stop", {
        method: "POST"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/position-lifecycle/status"] });
    }
  });

  const handleCheckUser = () => {
    if (!userAddress.trim()) return;
    checkUserMutation.mutate(userAddress.trim());
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Position Lifecycle Monitor
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Service Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Service Status</span>
            <div className="flex items-center gap-2">
              {isStatusLoading ? (
                <Badge variant="secondary">Loading...</Badge>
              ) : status.isRunning ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Running
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Stopped
                </Badge>
              )}
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {status.isRunning 
              ? "Automatically checking all user positions every 2 minutes for burned/closed positions and Step 2 completion needs."
              : "Position lifecycle management is not running. Manual monitoring only."
            }
          </div>
        </div>

        <Separator />

        {/* Service Controls */}
        <div className="space-y-3">
          <span className="font-medium">Service Controls</span>
          <div className="flex gap-2">
            <Button
              onClick={() => startServiceMutation.mutate()}
              disabled={status.isRunning || startServiceMutation.isPending}
              variant="default"
              size="sm"
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
            <Button
              onClick={() => stopServiceMutation.mutate()}
              disabled={!status.isRunning || stopServiceMutation.isPending}
              variant="outline"
              size="sm"
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
          </div>
        </div>

        <Separator />

        {/* Manual User Check */}
        <div className="space-y-3">
          <Label htmlFor="userAddress" className="font-medium">
            Manual Position Check
          </Label>
          <div className="flex gap-2">
            <Input
              id="userAddress"
              placeholder="0x... (user wallet address)"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleCheckUser}
              disabled={!userAddress.trim() || checkUserMutation.isPending}
              variant="outline"
              size="sm"
            >
              <User className="h-4 w-4 mr-1" />
              {checkUserMutation.isPending ? "Checking..." : "Check"}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Manually trigger position check for a specific user address
          </div>
        </div>

        {/* Status Messages */}
        {(checkUserMutation.isSuccess || checkUserMutation.isError) && (
          <div className="space-y-2">
            {checkUserMutation.isSuccess && (
              <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950 p-2 rounded">
                ✅ Position check completed for {userAddress}
              </div>
            )}
            {checkUserMutation.isError && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                ❌ Failed to check positions for {userAddress}
              </div>
            )}
          </div>
        )}

        {(startServiceMutation.isSuccess || stopServiceMutation.isSuccess) && (
          <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950 p-2 rounded">
            ✅ Service status updated successfully
          </div>
        )}
      </CardContent>
    </Card>
  );
}