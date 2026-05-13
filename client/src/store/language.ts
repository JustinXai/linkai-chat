import Cookies from 'js-cookie';
import { atomWithLocalStorage } from './utils';

const defaultLang = () => {
  const userLang = navigator.language || navigator.languages[0];
  // 优先使用中文简体
  if (userLang.startsWith('zh')) {
    return 'zh-Hans';
  }
  return Cookies.get('lang') || localStorage.getItem('lang') || userLang;
};

const lang = atomWithLocalStorage('lang', defaultLang());

export default { lang };
