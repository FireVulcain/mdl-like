'use client';

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressTrackerProps {
  current: number;
  total?: number | null;
  status: string;
  onUpdate?: (progress: number) => void;
  className?: string;
}

export function ProgressTracker({ current, total, status, onUpdate, className }: ProgressTrackerProps) {
  // Local state for immediate feedback
  const [progress, setProgress] = useState(current);

  const handleUpdate = (newVal: number) => {
    const val = Math.max(0, newVal);
    // If total is known, don't exceed it
    const limit = total || 9999;
    const finalVal = Math.min(val, limit);
    
    setProgress(finalVal);
    onUpdate?.(finalVal);
  };

  const percentage = total ? (progress / total) * 100 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">
          {progress} {total ? `/ ${total}` : 'eps'}
        </span>
      </div>
      
      {total && (
        <Progress value={percentage} className="h-2" />
      )}

      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => handleUpdate(progress - 1)}
          disabled={progress <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input 
          type="number" 
          className="h-8 w-16 text-center" 
          value={progress}
          onChange={(e) => handleUpdate(parseInt(e.target.value) || 0)}
        />
        <Button 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => handleUpdate(progress + 1)}
          disabled={total ? progress >= total : false}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
