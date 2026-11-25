import { CheckCircle2, Clock, Send, XCircle } from 'lucide-react';
import type { RegistrationStatus } from '../types';

interface StatusLabelProps {
  status: RegistrationStatus | string | undefined;
}

export function StatusLabel({ status }: StatusLabelProps) {
  switch (status) {
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Completed
        </span>
      );
    case 'Submitted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
          <Send className="h-3.5 w-3.5 shrink-0" />
          Submitted
        </span>
      );
    case 'Cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          Cancelled
        </span>
      );
    case 'Pending':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Pending
        </span>
      );
  }
}
