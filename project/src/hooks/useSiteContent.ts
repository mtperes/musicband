import { createContext, useContext } from 'react';
import { defaultSiteContent } from '../utils/siteContent';

export const SiteContentContext = createContext(defaultSiteContent());

export function useSiteContent() {
  return useContext(SiteContentContext);
}