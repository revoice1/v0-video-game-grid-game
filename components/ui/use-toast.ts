// Keep the canonical hook implementation under hooks/ and re-export it here
// so existing UI-layer imports continue to work without maintaining a duplicate copy.
export { toast, useToast } from '@/hooks/use-toast'
