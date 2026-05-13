import { atom } from 'recoil';

/** Model mode types */
export type TModelMode = 'gpt' | 'gemini' | 'claude' | 'search' | 'image' | 'video';

/** Current selected model mode */
const modelMode = atom<TModelMode>({
  key: 'modelMode',
  default: 'gpt',
});

export default { modelMode };
