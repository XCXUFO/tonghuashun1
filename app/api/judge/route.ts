import { setting } from '@/lib/runtime';
import { createJudgeHandler } from '@/lib/judge';
export const POST = createJudgeHandler({ setting });
