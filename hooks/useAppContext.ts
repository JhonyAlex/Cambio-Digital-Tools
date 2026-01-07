
import { useOutletContext } from 'react-router-dom';
import { AppContextType } from '../types';

export const useAppContext = () => {
  return useOutletContext<AppContextType>();
};
